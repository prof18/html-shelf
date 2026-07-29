import { afterEach, describe, expect, it, vi } from "vitest";
import { FileView, Platform, type PluginManifest, type TFile } from "obsidian";
import HtmlShelfPlugin from "../../src/main";
import { HtmlView } from "../../src/views/HtmlView";
import { VIEW_TYPE_HTML } from "../../src/views/view-types";
import { createFakeApp, createFakeLeaf } from "../mocks/fake-app";
import {
  noticeMessages,
  WorkspaceLeaf as MockWorkspaceLeaf,
} from "../mocks/obsidian";

const manifest: PluginManifest = {
  id: "html-shelf",
  name: "HTML Shelf",
  author: "Marco Gomiero",
  version: "0.1.0",
  minAppVersion: "1.5.0",
  description: "Test manifest",
};

describe("HtmlView", () => {
  afterEach(() => {
    Platform.isMobile = false;
    Platform.isIosApp = false;
    document.body.classList.remove("theme-dark");
    document.body.replaceChildren();
    noticeMessages.splice(0);
    vi.restoreAllMocks();
  });

  it("uses file-view metadata and derives its tab title", async () => {
    const harness = createFakeApp([
      { path: "plans/alpha-plan.html", content: "<title>Alpha plan</title>" },
    ]);
    const plugin = new HtmlShelfPlugin(harness.app, manifest);
    const view = new HtmlView(createFakeLeaf(harness.app), plugin);
    const file = harness.file("plans/alpha-plan.html")! as unknown as TFile;

    expect(view).toBeInstanceOf(FileView);
    expect(view.allowNoFile).toBe(false);
    expect(view.getViewType()).toBe(VIEW_TYPE_HTML);
    expect(view.getIcon()).toBe("file-code-2");
    expect(view.getDisplayText()).toBe("HTML page");

    view.file = file;
    expect(view.getDisplayText()).toBe("alpha-plan");
    await view.onLoadFile(file);
    expect(view.getDisplayText()).toBe("Alpha plan");
  });

  it("falls back to the basename when title loading fails", async () => {
    const harness = createFakeApp([
      { path: "plans/unavailable.html", content: "<title>Unavailable</title>" },
    ]);
    const plugin = new HtmlShelfPlugin(harness.app, manifest);
    const view = new HtmlView(createFakeLeaf(harness.app), plugin);
    const file = harness.file("plans/unavailable.html")! as unknown as TFile;
    harness.deleteFile(file.path);

    await view.onLoadFile(file);

    expect(view.getDisplayText()).toBe("unavailable");
  });

  it("humanizes the basename when readable HTML has no title", async () => {
    const harness = createFakeApp([
      { path: "plans/untitled-page.html", content: "<p>Content only</p>" },
    ]);
    const plugin = new HtmlShelfPlugin(harness.app, manifest);
    const view = new HtmlView(createFakeLeaf(harness.app), plugin);

    await view.onLoadFile(
      harness.file("plans/untitled-page.html")! as unknown as TFile,
    );

    expect(view.getDisplayText()).toBe("Untitled page");
  });

  it("renders sanitized HTML in a sandboxed iframe with vault resources", async () => {
    document.body.classList.add("theme-dark");
    const harness = createFakeApp([
      {
        path: "plans/page.html",
        content:
          '<title>Rendered page</title><img src="asset.png"><script>alert(1)</script>',
      },
    ]);
    const plugin = new HtmlShelfPlugin(harness.app, manifest);
    const view = new HtmlView(createFakeLeaf(harness.app), plugin);
    const file = harness.file("plans/page.html")! as unknown as TFile;

    await view.onLoadFile(file);

    const frame = view.contentEl.querySelector<HTMLIFrameElement>(".hs-frame");
    expect(frame).not.toBeNull();
    expect(frame?.getAttribute("sandbox")).toBe("allow-same-origin");
    expect(frame?.getAttribute("sandbox")).not.toContain("allow-scripts");
    expect(frame?.srcdoc).toContain('data-hs-theme="dark"');
    expect(frame?.srcdoc).toContain('src="app://vault/plans/asset.png"');
    expect(frame?.srcdoc).not.toContain("<script");
    expect(harness.readCount(file.path)).toBe(1);
    expect(view.getDisplayText()).toBe("Rendered page");
  });

  it("uses Obsidian's platform API for mobile page clearance", async () => {
    document.body.classList.remove("is-mobile");
    Platform.isMobile = true;
    const harness = createFakeApp([
      { path: "page.html", content: "<title>Mobile page</title>" },
    ]);
    const plugin = new HtmlShelfPlugin(harness.app, manifest);
    const view = new HtmlView(createFakeLeaf(harness.app), plugin);

    await view.onLoadFile(harness.file("page.html")! as unknown as TFile);

    expect(
      view.contentEl.querySelector<HTMLIFrameElement>(".hs-frame")?.srcdoc,
    ).toContain('data-hs-mobile="true"');
  });

  it("inlines local images in the iOS renderer", async () => {
    Platform.isIosApp = true;
    const harness = createFakeApp([
      { path: "plans/page.html", content: '<img src="diagram.png">' },
      { path: "plans/diagram.png", content: "png bytes" },
    ]);
    const plugin = new HtmlShelfPlugin(harness.app, manifest);
    const view = new HtmlView(createFakeLeaf(harness.app), plugin);

    await view.onLoadFile(harness.file("plans/page.html")! as unknown as TFile);

    expect(
      view.contentEl.querySelector<HTMLIFrameElement>(".hs-frame")?.srcdoc,
    ).toContain('src="data:image/png;base64,cG5nIGJ5dGVz"');
  });

  it("wires the loaded document and consumes a pending anchor", async () => {
    const harness = createFakeApp([
      { path: "page.html", content: '<h2 id="target">Target</h2>' },
    ]);
    const plugin = new HtmlShelfPlugin(harness.app, manifest);
    const wiredFrames: HTMLIFrameElement[] = [];
    class TestHtmlView extends HtmlView {
      protected override wireLinks(frame: HTMLIFrameElement): void {
        wiredFrames.push(frame);
      }
    }
    const view = new TestHtmlView(createFakeLeaf(harness.app), plugin);
    document.body.append(view.containerEl);
    view.pendingAnchor = "target";
    await view.onLoadFile(harness.file("page.html")! as unknown as TFile);
    const frame = view.contentEl.querySelector<HTMLIFrameElement>(".hs-frame")!;
    const target = frame.contentDocument!.createElement("h2");
    target.id = "target";
    const scrollIntoView = vi.fn();
    target.scrollIntoView = scrollIntoView;
    frame.contentDocument!.body.append(target);

    frame.dispatchEvent(new Event("load"));

    expect(wiredFrames).toEqual([frame]);
    expect(scrollIntoView).toHaveBeenCalledOnce();
    expect(view.pendingAnchor).toBeNull();
  });

  it("renders a read error instead of a blank iframe", async () => {
    const harness = createFakeApp([
      { path: "missing.html", content: "<title>Missing</title>" },
    ]);
    const plugin = new HtmlShelfPlugin(harness.app, manifest);
    const view = new HtmlView(createFakeLeaf(harness.app), plugin);
    const file = harness.file("missing.html")! as unknown as TFile;
    harness.deleteFile(file.path);

    await view.onLoadFile(file);

    expect(view.contentEl.textContent).toBe("Could not read this file.");
    expect(view.contentEl.querySelector("iframe")).toBeNull();
    expect(view.getDisplayText()).toBe("missing");
  });

  it("distinguishes a genuinely empty file from a read failure", async () => {
    const harness = createFakeApp([{ path: "empty.html", content: "" }]);
    const plugin = new HtmlShelfPlugin(harness.app, manifest);
    const view = new HtmlView(createFakeLeaf(harness.app), plugin);

    await view.onLoadFile(harness.file("empty.html")! as unknown as TFile);

    expect(view.contentEl.textContent).toBe("This file is empty.");
    expect(view.contentEl.querySelector("iframe")).toBeNull();
    expect(harness.readCount("empty.html")).toBe(1);
  });

  it("routes a delegated page click in the same view and records history", async () => {
    const harness = createFakeApp([
      { path: "plans/current.html", content: "<title>Current</title>" },
      { path: "plans/next.html", content: "<title>Next</title>" },
    ]);
    const plugin = new HtmlShelfPlugin(harness.app, manifest);
    const leaf = new MockWorkspaceLeaf(harness.app);
    const view = new HtmlView(leaf as never, plugin);
    document.body.append(view.containerEl);
    await view.onLoadFile(
      harness.file("plans/current.html")! as unknown as TFile,
    );
    const frame = view.contentEl.querySelector<HTMLIFrameElement>(".hs-frame")!;
    Object.defineProperty(frame.contentWindow, "scrollY", {
      value: 84,
      configurable: true,
    });
    const anchor = frame.contentDocument!.createElement("a");
    anchor.setAttribute(
      "data-hs-link",
      JSON.stringify({
        kind: "page",
        path: "plans/next.html",
        anchor: "detail",
      }),
    );
    frame.contentDocument!.body.append(anchor);
    frame.dispatchEvent(new Event("load"));

    anchor.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(view.history).toEqual([{ path: "plans/current.html", scrollY: 84 }]);
    expect(view.pendingAnchor).toBe("detail");
    expect(leaf.openedFiles.map(({ path }) => path)).toEqual([
      "plans/next.html",
    ]);
    await vi.waitFor(() =>
      expect(
        view.contentEl.querySelector<HTMLButtonElement>(
          '[aria-label="Go back in page history"]',
        )?.disabled,
      ).toBe(false),
    );
  });

  it("removes stale document listeners when rewired and unloaded", async () => {
    const harness = createFakeApp([
      { path: "page.html", content: "<title>Page</title>" },
    ]);
    const plugin = new HtmlShelfPlugin(harness.app, manifest);
    class TestHtmlView extends HtmlView {
      wire(frame: HTMLIFrameElement): void {
        this.wireLinks(frame);
      }
    }
    const view = new TestHtmlView(createFakeLeaf(harness.app), plugin);
    const first = document.createElement("iframe");
    const second = document.createElement("iframe");
    document.body.append(first, second);
    const appendUnsupportedLink = (frame: HTMLIFrameElement) => {
      const anchor = frame.contentDocument!.createElement("a");
      anchor.setAttribute(
        "data-hs-link",
        JSON.stringify({ kind: "unsupported", href: "page.pdf" }),
      );
      frame.contentDocument!.body.append(anchor);
      return anchor;
    };
    const firstLink = appendUnsupportedLink(first);
    const secondLink = appendUnsupportedLink(second);

    view.wire(first);
    view.wire(second);
    firstLink.click();
    secondLink.click();
    expect(noticeMessages).toEqual(["This link type can't be opened here."]);

    await view.onUnloadFile(harness.file("page.html")! as unknown as TFile);
    secondLink.click();
    expect(noticeMessages).toHaveLength(1);

    view.wire(second);
    await view.onClose();
    secondLink.click();
    expect(noticeMessages).toHaveLength(1);
  });

  it("routes iframe anchor, index, external, unsupported, and plain clicks", async () => {
    const harness = createFakeApp([
      { path: "page.html", content: "<title>Page</title>" },
    ]);
    const plugin = new HtmlShelfPlugin(harness.app, manifest);
    const activateShelf = vi
      .spyOn(plugin, "activateShelf")
      .mockResolvedValue(undefined);
    const openExternal = vi.spyOn(window, "open").mockReturnValue(null);
    const view = new HtmlView(createFakeLeaf(harness.app), plugin);
    document.body.append(view.containerEl);
    await view.onLoadFile(harness.file("page.html")! as unknown as TFile);
    const frame = view.contentEl.querySelector<HTMLIFrameElement>(".hs-frame")!;
    const doc = frame.contentDocument!;
    const target = doc.createElement("a");
    target.name = "detail";
    const scrollIntoView = vi.fn();
    target.scrollIntoView = scrollIntoView;
    doc.body.append(target);
    const clickTarget = (linkTarget: object) => {
      const anchor = doc.createElement("a");
      anchor.setAttribute("data-hs-link", JSON.stringify(linkTarget));
      doc.body.append(anchor);
      anchor.click();
    };
    frame.dispatchEvent(new Event("load"));

    clickTarget({ kind: "anchor", anchor: "detail" });
    clickTarget({ kind: "index", path: "index.html" });
    clickTarget({ kind: "external", href: "https://example.com" });
    clickTarget({ kind: "unsupported", href: "page.pdf" });
    const plain = doc.createElement("span");
    doc.body.append(plain);
    plain.click();
    await Promise.resolve();

    expect(scrollIntoView).toHaveBeenCalledOnce();
    expect(activateShelf).toHaveBeenCalledOnce();
    expect(openExternal).toHaveBeenCalledWith("https://example.com");
    expect(noticeMessages).toEqual(["This link type can't be opened here."]);
  });

  it("goes back without repushing history and restores scroll after load", async () => {
    const harness = createFakeApp([
      { path: "previous.html", content: "<title>Previous</title>" },
      { path: "current.html", content: "<title>Current</title>" },
    ]);
    const plugin = new HtmlShelfPlugin(harness.app, manifest);
    const leaf = new MockWorkspaceLeaf(harness.app);
    const view = new HtmlView(leaf as never, plugin);
    document.body.append(view.containerEl);
    await view.onLoadFile(harness.file("current.html")! as unknown as TFile);
    view.history.push({ path: "previous.html", scrollY: 146 });

    expect(view.canGoBack()).toBe(true);
    await view.goBack();

    expect(view.history).toEqual([]);
    expect(leaf.openedFiles.map(({ path }) => path)).toEqual(["previous.html"]);
    await view.onLoadFile(harness.file("previous.html")! as unknown as TFile);
    const frame = view.contentEl.querySelector<HTMLIFrameElement>(".hs-frame")!;
    const scrollTo = vi.fn();
    Object.defineProperty(frame.contentWindow, "scrollTo", {
      value: scrollTo,
      configurable: true,
    });
    frame.dispatchEvent(new Event("load"));
    expect(scrollTo).toHaveBeenCalledWith(0, 146);
  });

  it("keeps a missing back target in history and shows a notice", async () => {
    const harness = createFakeApp([
      { path: "current.html", content: "<title>Current</title>" },
    ]);
    const plugin = new HtmlShelfPlugin(harness.app, manifest);
    const leaf = new MockWorkspaceLeaf(harness.app);
    const view = new HtmlView(leaf as never, plugin);
    view.history.push({ path: "gone.html", scrollY: 20 });

    await view.goBack();

    expect(view.history).toEqual([{ path: "gone.html", scrollY: 20 }]);
    expect(leaf.openedFiles).toEqual([]);
    expect(noticeMessages).toEqual(["Linked page not found: gone.html"]);
  });

  it("renders compact back and shelf controls", async () => {
    const harness = createFakeApp([
      { path: "page.html", content: "<title>Page</title>" },
    ]);
    const plugin = new HtmlShelfPlugin(harness.app, manifest);
    const activateShelf = vi
      .spyOn(plugin, "activateShelf")
      .mockResolvedValue(undefined);
    const view = new HtmlView(createFakeLeaf(harness.app), plugin);

    await view.onLoadFile(harness.file("page.html")! as unknown as TFile);

    const bar = view.contentEl.querySelector(".hs-pagebar");
    const back = bar?.querySelector<HTMLButtonElement>(
      '[aria-label="Go back in page history"]',
    );
    const shelf = bar?.querySelector<HTMLButtonElement>(
      '[aria-label="Open HTML shelf"]',
    );
    expect(bar).not.toBeNull();
    expect(back?.disabled).toBe(true);
    shelf?.click();
    expect(activateShelf).toHaveBeenCalledOnce();
  });

  it("reacts to css-change without rereading or replacing srcdoc", async () => {
    const harness = createFakeApp([
      { path: "page.html", content: "<title>Page</title>" },
    ]);
    const plugin = new HtmlShelfPlugin(harness.app, manifest);
    plugin.onload();
    const leaf = harness.app.workspace.getLeaf(true);
    await leaf.setViewState({ type: VIEW_TYPE_HTML });
    const view = new HtmlView(leaf, plugin);
    (leaf as unknown as MockWorkspaceLeaf).view = view;
    document.body.append(view.containerEl);
    await view.onLoadFile(harness.file("page.html")! as unknown as TFile);
    const frame = view.contentEl.querySelector<HTMLIFrameElement>(".hs-frame")!;
    frame.contentDocument!.documentElement.dataset.hsTheme = "light";
    const srcdoc = frame.srcdoc;
    const reads = harness.readCount("page.html");
    document.body.classList.add("theme-dark");

    harness.emitWorkspace("css-change");

    expect(frame.contentDocument?.documentElement.dataset.hsTheme).toBe("dark");
    expect(frame.srcdoc).toBe(srcdoc);
    expect(harness.readCount("page.html")).toBe(reads);
  });

  it("round-trips FileView history and scroll state", async () => {
    const harness = createFakeApp([
      { path: "page.html", content: "<title>Page</title>" },
    ]);
    const plugin = new HtmlShelfPlugin(harness.app, manifest);
    const first = new HtmlView(createFakeLeaf(harness.app), plugin);
    document.body.append(first.containerEl);
    await first.onLoadFile(harness.file("page.html")! as unknown as TFile);
    first.history.push({ path: "previous.html", scrollY: 32 });
    const firstFrame =
      first.contentEl.querySelector<HTMLIFrameElement>(".hs-frame")!;
    Object.defineProperty(firstFrame.contentWindow, "scrollY", {
      value: 218,
      configurable: true,
    });

    const state = first.getState();
    const restored = new HtmlView(createFakeLeaf(harness.app), plugin);
    await restored.setState(state, { history: false });

    expect(state.file).toBe("page.html");
    expect(restored.getState()).toMatchObject({
      file: "page.html",
      htmlShelfHistory: [{ path: "previous.html", scrollY: 32 }],
      htmlShelfScrollY: 218,
    });
    expect(restored.canGoBack()).toBe(true);
  });

  it("preserves navigation state when FileView changes only the file", async () => {
    const harness = createFakeApp([
      { path: "next.html", content: "<title>Next</title>" },
    ]);
    const plugin = new HtmlShelfPlugin(harness.app, manifest);
    const view = new HtmlView(createFakeLeaf(harness.app), plugin);
    view.history.push({ path: "previous.html", scrollY: 48 });

    await view.setState({ file: "next.html" }, { history: false });

    expect(view.history).toEqual([{ path: "previous.html", scrollY: 48 }]);
    expect(view.canGoBack()).toBe(true);
  });

  it("ignores malformed persisted navigation state", async () => {
    const harness = createFakeApp([]);
    const plugin = new HtmlShelfPlugin(harness.app, manifest);
    const view = new HtmlView(createFakeLeaf(harness.app), plugin);

    await view.setState(
      {
        htmlShelfHistory: [
          null,
          { path: 42, scrollY: "bad" },
          { path: "valid.html", scrollY: -1 },
        ],
        htmlShelfScrollY: "bad",
      },
      { history: false },
    );

    expect(view.history).toEqual([]);
    expect(view.getState()).toMatchObject({
      htmlShelfHistory: [],
      htmlShelfScrollY: 0,
    });
  });
});
