import {
  FileView,
  ItemView,
  Notice,
  Platform,
  TFile,
  type WorkspaceLeaf,
} from "obsidian";
import type { ShelfEntry, ShelfSection, ShelfSettings } from "../core/model";
import { isHtmlPath } from "../core/scan";
import { filterSections } from "../core/search";
import type { ShelfIndex } from "./ShelfIndex";
import { VIEW_TYPE_HTML, VIEW_TYPE_SHELF } from "./view-types";

export class ShelfView extends ItemView {
  private sections: ShelfSection[] = [];
  private searchTimer: number | null = null;
  private refreshTimer: number | null = null;
  private searchElement: HTMLInputElement | null = null;
  private sectionsElement: HTMLElement | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly index: ShelfIndex,
    private readonly getSettings: () => ShelfSettings,
    private readonly getExtensionsRegistered: () => boolean = () => true,
  ) {
    super(leaf);
  }

  async onOpen(): Promise<void> {
    this.contentEl.empty();
    const shelf = this.contentEl.createDiv({ cls: "hs-shelf" });
    shelf.classList.toggle("hs-mobile", Platform.isMobile);
    const toolbar = shelf.createDiv({ cls: "hs-toolbar" });
    toolbar.createEl("h1", { cls: "hs-title", text: "HTML shelf" });
    toolbar.createDiv({
      cls: "hs-build-marker",
      text: "Test build: ios-links-20260729-1",
    });
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
    });
    this.registerVaultEvents();
  }

  getViewType(): string {
    return VIEW_TYPE_SHELF;
  }

  getDisplayText(): string {
    return "HTML shelf";
  }

  getIcon(): string {
    return "library";
  }

  private renderSections(
    sectionsElement: HTMLElement,
    sections: ShelfSection[],
    filtered: boolean,
  ): void {
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
          text: "Your folder filters may be excluding them — check the HTML Shelf settings.",
        });
      }
      return;
    }

    for (const section of sections) {
      const sectionElement = sectionsElement.createDiv({ cls: "hs-section" });
      const header = sectionElement.createDiv({ cls: "hs-section-header" });
      header.createEl("span", { text: section.name });
      header.createEl("span", {
        cls: "hs-section-count",
        text: String(section.entries.length),
      });
      for (const entry of section.entries) {
        const button = sectionElement.createEl("button", {
          cls: "hs-entry",
          attr: { type: "button" },
        });
        button.createEl("span", { cls: "hs-entry-title", text: entry.title });
        button.createEl("span", { cls: "hs-entry-path", text: entry.path });
        this.registerDomEvent(button, "click", () => {
          void this.openEntry(entry);
        });
      }
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
      await this.app.workspace.revealLeaf(existing);
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
