import { FileView, Notice, setIcon, TFile, type WorkspaceLeaf } from "obsidian";
import type HtmlShelfPlugin from "../main";
import { deriveTitle } from "../core/titles";
import { prepareHtml } from "../core/sanitize";
import { VIEW_TYPE_HTML } from "./view-types";
import {
  createLinkClickHandler,
  routeLink,
  type PageHistoryEntry,
} from "./navigation";

const isDarkTheme = (): boolean =>
  document.body.classList.contains("theme-dark");

export class HtmlView extends FileView {
  allowNoFile = false;
  readonly history: PageHistoryEntry[] = [];
  pendingAnchor: string | null = null;
  private pendingScrollY: number | null = null;
  private title: string | null = null;
  private frame: HTMLIFrameElement | null = null;
  private backButton: HTMLButtonElement | null = null;
  private documentListener: {
    doc: Document;
    listener: EventListener;
  } | null = null;

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
    this.frame = frame;
    frame.setAttribute("sandbox", "allow-same-origin");
    this.renderPagebar();
    frame.addEventListener(
      "load",
      () => {
        this.wireLinks(frame);
        if (this.pendingAnchor) {
          this.scrollToAnchor(this.pendingAnchor);
          this.pendingAnchor = null;
        }
        if (this.pendingScrollY !== null) {
          frame.contentWindow?.scrollTo(0, this.pendingScrollY);
          this.pendingScrollY = null;
        }
      },
      { once: true },
    );
    frame.srcdoc = prepared;
  }

  protected wireLinks(frame: HTMLIFrameElement): void {
    this.removeDocumentListener();
    const doc = frame.contentDocument;
    if (!doc) return;
    const listener = createLinkClickHandler(async (target) => {
      await routeLink(target, {
        currentPath: this.file?.path ?? null,
        currentScrollY: this.frame?.contentWindow?.scrollY ?? 0,
        history: this.history,
        pageExists: (path) =>
          this.app.vault.getAbstractFileByPath(path) instanceof TFile,
        openFile: async (path, anchor) => {
          const file = this.app.vault.getAbstractFileByPath(path);
          if (!(file instanceof TFile)) return;
          this.pendingAnchor = anchor ?? null;
          await this.leaf.openFile(file);
        },
        activateShelf: () => this.plugin.activateShelf(),
        openExternal: (href) => void window.open(href),
        notice: (message) => void new Notice(message),
        scrollToAnchor: (anchor) => this.scrollToAnchor(anchor),
      });
      this.updateBackButton();
    });
    doc.addEventListener("click", listener);
    this.documentListener = { doc, listener };
  }

  async onUnloadFile(file: TFile): Promise<void> {
    this.removeDocumentListener();
    this.frame = null;
    this.backButton = null;
    await super.onUnloadFile(file);
  }

  onClose(): Promise<void> {
    this.removeDocumentListener();
    this.frame = null;
    this.backButton = null;
    return Promise.resolve();
  }

  canGoBack(): boolean {
    return this.history.length > 0;
  }

  async goBack(): Promise<void> {
    const previous = this.history[this.history.length - 1];
    if (!previous) return;
    const file = this.app.vault.getAbstractFileByPath(previous.path);
    if (!(file instanceof TFile)) {
      new Notice(`Linked page not found: ${previous.path}`);
      return;
    }

    this.pendingScrollY = previous.scrollY;
    try {
      await this.leaf.openFile(file);
      this.history.pop();
      this.updateBackButton();
    } catch (error) {
      this.pendingScrollY = null;
      throw error;
    }
  }

  private scrollToAnchor(anchor: string): void {
    const doc = this.frame?.contentDocument;
    const target =
      doc?.getElementById(anchor) ?? doc?.getElementsByName(anchor)[0];
    target?.scrollIntoView();
  }

  private removeDocumentListener(): void {
    if (!this.documentListener) return;
    const { doc, listener } = this.documentListener;
    doc.removeEventListener("click", listener);
    this.documentListener = null;
  }

  private renderPagebar(): void {
    const bar = this.contentEl.createDiv({ cls: "hs-pagebar" });
    const back = bar.createEl("button", {
      cls: "hs-pagebar-button clickable-icon",
      attr: {
        type: "button",
        "aria-label": "Go back in page history",
        title: "Go back in page history",
      },
    });
    setIcon(back, "arrow-left");
    back.addEventListener("click", () => void this.goBack());
    this.backButton = back;
    this.updateBackButton();

    const shelf = bar.createEl("button", {
      cls: "hs-pagebar-button clickable-icon",
      attr: {
        type: "button",
        "aria-label": "Open HTML shelf",
        title: "Open HTML shelf",
      },
    });
    setIcon(shelf, "library");
    shelf.addEventListener("click", () => void this.plugin.activateShelf());
  }

  private updateBackButton(): void {
    if (this.backButton) this.backButton.disabled = !this.canGoBack();
  }

  private renderMessage(message: string): void {
    this.contentEl.empty();
    this.frame = null;
    this.backButton = null;
    this.contentEl.createDiv({ cls: "hs-page-message", text: message });
  }
}
