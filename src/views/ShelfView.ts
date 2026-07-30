import {
  FileView,
  ItemView,
  Menu,
  Notice,
  Platform,
  TFile,
  type WorkspaceLeaf,
} from "obsidian";
import type { ShelfEntry, ShelfSection, ShelfSettings } from "../core/model";
import { isHtmlPath } from "../core/scan";
import { filterSections } from "../core/search";
import { DeleteConfirmationModal } from "./DeleteConfirmationModal";
import type { ShelfIndex } from "./ShelfIndex";
import { VIEW_TYPE_HTML, VIEW_TYPE_SHELF } from "./view-types";

const LONG_PRESS_MS = 500;
const LONG_PRESS_MOVE_TOLERANCE = 10;
const SUPPRESS_CLICK_MS = 750;
const DESKTOP_MENU_DEDUPE_MS = 250;

export class ShelfView extends ItemView {
  private sections: ShelfSection[] = [];
  private searchTimer: number | null = null;
  private refreshTimer: number | null = null;
  private searchElement: HTMLInputElement | null = null;
  private sectionsElement: HTMLElement | null = null;
  private longPressTimer: number | null = null;
  private longPressStart: { x: number; y: number } | null = null;
  private longPressTriggered = false;
  private suppressClickUntil = 0;
  private lastDesktopMenuAt = Number.NEGATIVE_INFINITY;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly index: ShelfIndex,
    private readonly getSettings: () => ShelfSettings,
    private readonly getExtensionsRegistered: () => boolean = () => true,
    private readonly subscribeToSettings: (
      callback: () => void,
    ) => () => void = () => () => undefined,
  ) {
    super(leaf);
  }

  async onOpen(): Promise<void> {
    this.contentEl.empty();
    const shelf = this.contentEl.createDiv({ cls: "hs-shelf" });
    shelf.classList.toggle("hs-mobile", Platform.isMobile);
    const toolbar = shelf.createDiv({ cls: "hs-toolbar" });
    toolbar.createEl("h1", { cls: "hs-title", text: "HTML Shelf" });
    const search = toolbar.createEl("input", {
      cls: "hs-search",
      attr: {
        type: "search",
        placeholder: "Filter pages…",
        "aria-label": "Filter pages",
      },
    });
    const sectionsElement = shelf.createDiv({ cls: "hs-sections" });
    this.searchElement = search;
    this.sectionsElement = sectionsElement;
    sectionsElement.createDiv({ cls: "hs-scanning", text: "Scanning vault…" });
    this.sections = await this.index.build();
    this.renderSections(sectionsElement, this.sections, false);
    this.registerDomEvent(search, "input", () => {
      if (this.searchTimer !== null) window.clearTimeout(this.searchTimer);
      this.searchTimer = window.setTimeout(() => {
        const scrollTop = sectionsElement.scrollTop;
        const query = search.value;
        this.renderSections(
          sectionsElement,
          filterSections(this.sections, query),
          query.trim().length > 0,
        );
        sectionsElement.scrollTop = scrollTop;
        this.searchTimer = null;
      }, 100);
    });
    this.register(() => {
      if (this.searchTimer !== null) window.clearTimeout(this.searchTimer);
      if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
      this.clearLongPress();
    });
    this.register(this.subscribeToSettings(() => this.scheduleRefresh()));
    this.registerVaultEvents();
  }

  getViewType(): string {
    return VIEW_TYPE_SHELF;
  }

  getDisplayText(): string {
    return "HTML Shelf";
  }

  getIcon(): string {
    return "library";
  }

  private renderSections(
    sectionsElement: HTMLElement,
    sections: ShelfSection[],
    filtered: boolean,
  ): void {
    this.clearLongPress();
    sectionsElement.empty();
    if (sections.length === 0) {
      if (filtered) {
        sectionsElement.createDiv({
          cls: "hs-no-results",
          text: "No pages match your filter.",
        });
        return;
      }
      const empty = sectionsElement.createDiv({ cls: "hs-empty" });
      empty.createEl("p", { text: "No HTML files found in this vault." });
      if (this.getSettings().includeFolders.length > 0) {
        empty.createEl("p", {
          text: "Your folder filters may be excluding them — check the HTML shelf settings.",
        });
      }
      return;
    }

    for (const section of sections) {
      const sectionElement = sectionsElement.createDiv({ cls: "hs-section" });
      const header = sectionElement.createDiv({ cls: "hs-section-header" });
      header.createSpan({ cls: "hs-section-name", text: section.name });
      header.createSpan({
        cls: "hs-section-count",
        text: String(section.entries.length),
      });
      for (const entry of section.entries) {
        const button = sectionElement.createEl("button", {
          cls: "hs-entry",
          attr: { type: "button" },
        });
        button.createSpan({ cls: "hs-entry-title", text: entry.title });
        button.createSpan({ cls: "hs-entry-path", text: entry.path });
        this.registerDomEvent(button, "click", (event) => {
          if (Date.now() < this.suppressClickUntil) {
            event.preventDefault();
            this.suppressClickUntil = 0;
            return;
          }
          void this.openEntry(entry);
        });
        this.registerEntryMenu(button, entry);
      }
    }
  }

  private registerEntryMenu(
    button: HTMLButtonElement,
    entry: ShelfEntry,
  ): void {
    this.registerDomEvent(button, "contextmenu", (event) => {
      event.preventDefault();
      if (
        !Platform.isMobile &&
        Date.now() - this.lastDesktopMenuAt > DESKTOP_MENU_DEDUPE_MS
      ) {
        this.lastDesktopMenuAt = Date.now();
        this.createEntryMenu(entry).showAtMouseEvent(event);
      }
    });

    this.registerDomEvent(button, "mousedown", (event) => {
      if (!Platform.isMobile && event.button === 2) {
        event.preventDefault();
        this.lastDesktopMenuAt = Date.now();
        this.createEntryMenu(entry).showAtMouseEvent(event);
      }
    });

    this.registerDomEvent(button, "pointerdown", (event) => {
      if (!Platform.isMobile) return;

      if (event.pointerType !== "touch" && event.pointerType !== "pen") {
        return;
      }

      this.clearLongPress();
      this.longPressTriggered = false;
      const startX = event.clientX;
      const startY = event.clientY;
      this.longPressStart = { x: startX, y: startY };
      this.longPressTimer = window.setTimeout(() => {
        this.longPressTimer = null;
        this.longPressStart = null;
        this.longPressTriggered = true;
        this.suppressClickUntil = Number.POSITIVE_INFINITY;
        this.showEntryMenu(entry, startX, startY);
      }, LONG_PRESS_MS);
    });

    this.registerDomEvent(button, "pointermove", (event) => {
      if (this.longPressTimer === null || this.longPressStart === null) return;
      if (
        Math.abs(event.clientX - this.longPressStart.x) >
          LONG_PRESS_MOVE_TOLERANCE ||
        Math.abs(event.clientY - this.longPressStart.y) >
          LONG_PRESS_MOVE_TOLERANCE
      ) {
        this.clearLongPress();
      }
    });
    this.registerDomEvent(button, "pointerup", () => this.endLongPress());
    this.registerDomEvent(button, "pointercancel", () => this.endLongPress());
  }

  private endLongPress(): void {
    if (this.longPressTriggered) {
      this.suppressClickUntil = Date.now() + SUPPRESS_CLICK_MS;
    }
    this.clearLongPress();
  }

  private clearLongPress(): void {
    if (this.longPressTimer !== null) {
      window.clearTimeout(this.longPressTimer);
    }
    this.longPressTimer = null;
    this.longPressStart = null;
    this.longPressTriggered = false;
  }

  private showEntryMenu(entry: ShelfEntry, x: number, y: number): void {
    this.createEntryMenu(entry).showAtPosition({ x, y });
  }

  private createEntryMenu(entry: ShelfEntry): Menu {
    const menu = new Menu();
    menu.addItem((item) =>
      item
        .setTitle("Copy path")
        .setIcon("copy")
        .onClick(() => {
          void this.copyEntryPath(entry);
        }),
    );
    menu.addItem((item) =>
      item
        .setTitle("Delete")
        .setIcon("trash-2")
        .setWarning(true)
        .onClick(() => {
          new DeleteConfirmationModal(this.app, entry.path, () => {
            void this.deleteEntry(entry);
          }).open();
        }),
    );
    return menu;
  }

  private async copyEntryPath(entry: ShelfEntry): Promise<void> {
    try {
      await navigator.clipboard.writeText(entry.path);
      new Notice(`Copied path: ${entry.path}`);
    } catch {
      new Notice(`Could not copy path: ${entry.path}`);
    }
  }

  private async deleteEntry(entry: ShelfEntry): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(entry.path);
    if (!(file instanceof TFile)) {
      new Notice(`File no longer exists: ${entry.path}`);
      return;
    }

    try {
      await this.app.fileManager.trashFile(file);
      new Notice(`Deleted: ${entry.path}`);
    } catch {
      new Notice(`Could not delete: ${entry.path}`);
    }
  }

  private async openEntry(entry: ShelfEntry): Promise<void> {
    const existing = this.app.workspace
      .getLeavesOfType(VIEW_TYPE_HTML)
      .find(
        (leaf) =>
          leaf.view instanceof FileView && leaf.view.file?.path === entry.path,
      );
    if (existing) {
      this.app.workspace.setActiveLeaf(existing, { focus: true });
      return;
    }

    const file = this.app.vault.getAbstractFileByPath(entry.path);
    if (file instanceof TFile) {
      const leaf = this.app.workspace.getLeaf(true);
      if (this.getExtensionsRegistered()) {
        await leaf.openFile(file);
      } else {
        await leaf.setViewState({
          type: VIEW_TYPE_HTML,
          state: { file: entry.path },
        });
      }
    } else {
      new Notice(`File no longer exists: ${entry.path}`);
    }
  }

  private registerVaultEvents(): void {
    this.registerEvent(
      this.app.vault.on("create", (file) => {
        if (this.isRelevantPath(file.path)) this.scheduleRefresh();
      }),
    );
    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (this.isRelevantPath(file.path)) {
          this.index.invalidate(file.path);
          this.scheduleRefresh();
        }
      }),
    );
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (this.isRelevantPath(file.path)) {
          this.index.invalidate(file.path);
          this.scheduleRefresh();
        }
      }),
    );
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        if (this.isRelevantPath(file.path) || this.isRelevantPath(oldPath)) {
          this.index.invalidate(oldPath);
          this.scheduleRefresh();
        }
      }),
    );
  }

  private isRelevantPath(path: string): boolean {
    return (
      isHtmlPath(path, this.getSettings().includeHtm) ||
      path.slice(path.lastIndexOf("/") + 1) === "html-shelf.json"
    );
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = null;
      void this.rebuild();
    }, 250);
  }

  private async rebuild(): Promise<void> {
    if (!this.searchElement || !this.sectionsElement) return;
    const query = this.searchElement.value;
    const scrollTop = this.sectionsElement.scrollTop;
    this.sections = await this.index.build();
    this.renderSections(
      this.sectionsElement,
      filterSections(this.sections, query),
      query.trim().length > 0,
    );
    this.sectionsElement.scrollTop = scrollTop;
  }
}
