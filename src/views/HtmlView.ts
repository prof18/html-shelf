import { FileView, type TFile, type WorkspaceLeaf } from "obsidian";
import type HtmlShelfPlugin from "../main";
import { deriveTitle } from "../core/titles";
import { VIEW_TYPE_HTML } from "./view-types";

export class HtmlView extends FileView {
  allowNoFile = false;
  private title: string | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    readonly plugin: HtmlShelfPlugin,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_HTML;
  }

  getDisplayText(): string {
    return this.title ?? this.file?.basename ?? "HTML page";
  }

  getIcon(): string {
    return "file-code-2";
  }

  async onLoadFile(file: TFile): Promise<void> {
    this.file = file;
    try {
      this.title = deriveTitle(
        await this.app.vault.cachedRead(file),
        file.basename,
      );
    } catch {
      this.title = file.basename;
    }
  }
}
