import { afterEach, describe, expect, it, vi } from "vitest";
import { FileView, type PluginManifest, type TFile } from "obsidian";
import HtmlShelfPlugin from "../../src/main";
import { HtmlView } from "../../src/views/HtmlView";
import { VIEW_TYPE_HTML } from "../../src/views/view-types";
import { createFakeApp, createFakeLeaf } from "../mocks/fake-app";

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
    document.body.classList.remove("theme-dark");
    document.body.replaceChildren();
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
});
