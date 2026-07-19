import {
  FileView,
  ItemView,
  Notice,
  TFile,
  type WorkspaceLeaf,
} from "obsidian";
import type { ShelfEntry, ShelfSection, ShelfSettings } from "../core/model";
import { filterSections } from "../core/search";
import type { ShelfIndex } from "./ShelfIndex";
import { VIEW_TYPE_HTML, VIEW_TYPE_SHELF } from "./view-types";

export class ShelfView extends ItemView {
  private sections: ShelfSection[] = [];
  private searchTimer: number | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly index: ShelfIndex,
    private readonly getSettings: () => ShelfSettings,
  ) {
    super(leaf);
  }

  async onOpen(): Promise<void> {
    this.contentEl.empty();
    const shelf = this.contentEl.createDiv({ cls: "hs-shelf" });
    const toolbar = shelf.createDiv({ cls: "hs-toolbar" });
    toolbar.createEl("h1", { cls: "hs-title", text: "HTML shelf" });
    const search = toolbar.createEl("input", {
      cls: "hs-search",
      attr: {
        type: "search",
        placeholder: "Filter pages…",
        "aria-label": "Filter pages",
      },
    });
    const sectionsElement = shelf.createDiv({ cls: "hs-sections" });
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
    });
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
      await this.app.workspace.getLeaf(true).openFile(file);
    } else {
      new Notice(`File no longer exists: ${entry.path}`);
    }
  }
}
