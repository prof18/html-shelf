import { describe, expect, it } from "vitest";
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
});
