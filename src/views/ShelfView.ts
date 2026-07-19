import {
  FileView,
  ItemView,
  Notice,
  TFile,
  type WorkspaceLeaf,
} from "obsidian";
import type { ShelfEntry, ShelfSection, ShelfSettings } from "../core/model";
import type { ShelfIndex } from "./ShelfIndex";
import { VIEW_TYPE_HTML, VIEW_TYPE_SHELF } from "./view-types";

export class ShelfView extends ItemView {
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
    toolbar.createEl("input", {
      cls: "hs-search",
      attr: {
        type: "search",
        placeholder: "Filter pages…",
        "aria-label": "Filter pages",
      },
    });
    const sectionsElement = shelf.createDiv({ cls: "hs-sections" });
    sectionsElement.createDiv({ cls: "hs-scanning", text: "Scanning vault…" });
    this.renderSections(sectionsElement, await this.index.build());
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
  ): void {
    sectionsElement.empty();
    if (sections.length === 0) {
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
