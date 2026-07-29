import { FileView, type TFile, type WorkspaceLeaf } from "obsidian";
import type HtmlShelfPlugin from "../main";
import { deriveTitle } from "../core/titles";
import { prepareHtml } from "../core/sanitize";
import { VIEW_TYPE_HTML } from "./view-types";

const isDarkTheme = (): boolean =>
  document.body.classList.contains("theme-dark");

export class HtmlView extends FileView {
  allowNoFile = false;
  pendingAnchor: string | null = null;
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
    let raw: string;
    try {
      raw = await this.app.vault.cachedRead(file);
    } catch {
      this.title = file.basename;
      this.renderMessage("Could not read this file.");
      return;
    }

    this.title = deriveTitle(raw, file.basename);
    if (raw.length === 0) {
      this.renderMessage("This file is empty.");
      return;
    }

    const prepared = prepareHtml(raw, {
      filePath: file.path,
      resourceUrl: (path) => this.app.vault.adapter.getResourcePath(path),
      theme: isDarkTheme() ? "dark" : "light",
    });
    this.contentEl.empty();
    const frame = this.contentEl.createEl("iframe", { cls: "hs-frame" });
    frame.setAttribute("sandbox", "allow-same-origin");
    frame.addEventListener("load", () => {
      this.wireLinks(frame);
      if (this.pendingAnchor) {
        frame.contentDocument
          ?.getElementById(this.pendingAnchor)
          ?.scrollIntoView();
        this.pendingAnchor = null;
      }
    });
    frame.srcdoc = prepared;
  }

  protected wireLinks(frame: HTMLIFrameElement): void {
    void frame;
  }

  private renderMessage(message: string): void {
    this.contentEl.empty();
    this.contentEl.createDiv({ cls: "hs-page-message", text: message });
  }
}
