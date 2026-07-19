import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PluginManifest } from "obsidian";
import HtmlShelfPlugin from "../../src/main";
import { DEFAULT_SETTINGS } from "../../src/core/model";
import { ShelfIndex } from "../../src/views/ShelfIndex";
import { ShelfView } from "../../src/views/ShelfView";
import { VIEW_TYPE_SHELF } from "../../src/views/view-types";
import {
  attachFileView,
  createFakeApp,
  createFakeLeaf,
} from "../mocks/fake-app";
import {
  noticeMessages,
  registeredCommands,
  registeredViews,
  ribbonItems,
} from "../mocks/obsidian";

const manifest: PluginManifest = {
  id: "html-shelf",
  name: "HTML Shelf",
  author: "Marco Gomiero",
  version: "0.1.0",
  minAppVersion: "1.5.0",
  description: "Test manifest",
};

describe("ShelfView metadata", () => {
  it("uses the shelf view type, display text, and icon", () => {
    const harness = createFakeApp([]);
    const index = new ShelfIndex(harness.app, () => DEFAULT_SETTINGS);
    const view = new ShelfView(
      createFakeLeaf(harness.app),
      index,
      () => DEFAULT_SETTINGS,
    );
    expect(view.getViewType()).toBe(VIEW_TYPE_SHELF);
    expect(view.getDisplayText()).toBe("HTML shelf");
    expect(view.getIcon()).toBe("library");
  });
});

describe("ShelfView rendering", () => {
  beforeEach(() => noticeMessages.splice(0));
  afterEach(() => vi.useRealTimers());

  it("renders grouped entries as semantic buttons and opens a file", async () => {
    const harness = createFakeApp([
      { path: "plans/alpha.html", content: "<title>Alpha plan</title>" },
      { path: "plans/index.html", content: "<title>Hidden index</title>" },
      { path: "loose.html", content: "<title>Loose page</title>" },
    ]);
    const index = new ShelfIndex(harness.app, () => DEFAULT_SETTINGS);
    const view = new ShelfView(
      createFakeLeaf(harness.app),
      index,
      () => DEFAULT_SETTINGS,
    );
    await view.onOpen();

    expect(
      view.contentEl.querySelector(".hs-search")?.getAttribute("placeholder"),
    ).toBe("Filter pages…");
    expect(
      [...view.contentEl.querySelectorAll(".hs-section-header")].map(
        (element) => element.textContent,
      ),
    ).toEqual(["(vault root)1", "plans1"]);
    const entries = [
      ...view.contentEl.querySelectorAll<HTMLButtonElement>("button.hs-entry"),
    ];
    expect(entries).toHaveLength(2);
    expect(entries[0]?.querySelectorAll(":scope > span")).toHaveLength(2);
    expect(view.contentEl.textContent).not.toContain("Hidden index");

    entries[1]?.click();
    await Promise.resolve();
    expect(harness.leaves).toHaveLength(1);
    expect(harness.leaves[0]?.openedFiles[0]?.path).toBe("plans/alpha.html");
  });

  it("shows the true empty state and filter guidance", async () => {
    const harness = createFakeApp([]);
    const filtered = { ...DEFAULT_SETTINGS, includeFolders: ["plans"] };
    const index = new ShelfIndex(harness.app, () => filtered);
    const view = new ShelfView(
      createFakeLeaf(harness.app),
      index,
      () => filtered,
    );
    await view.onOpen();
    expect(view.contentEl.querySelector(".hs-empty")?.textContent).toContain(
      "No HTML files found in this vault.",
    );
    expect(view.contentEl.querySelector(".hs-empty")?.textContent).toContain(
      "Your folder filters may be excluding them — check the HTML Shelf settings.",
    );
  });

  it("reveals an existing HTML page leaf instead of opening a duplicate", async () => {
    const harness = createFakeApp([
      { path: "page.html", content: "<title>Page</title>" },
    ]);
    const existing = harness.app.workspace.getLeaf(true);
    await existing.setViewState({ type: "html-shelf-page" });
    attachFileView(existing, harness.file("page.html")!);
    const index = new ShelfIndex(harness.app, () => DEFAULT_SETTINGS);
    const view = new ShelfView(
      createFakeLeaf(harness.app),
      index,
      () => DEFAULT_SETTINGS,
    );
    await view.onOpen();
    view.contentEl.querySelector<HTMLButtonElement>(".hs-entry")?.click();
    await Promise.resolve();
    expect(harness.leaves).toHaveLength(1);
    expect(harness.revealedLeaves).toEqual([harness.leaves[0]]);
  });

  it("shows a notice when a rendered file has gone stale", async () => {
    const harness = createFakeApp([
      { path: "page.html", content: "<title>Page</title>" },
    ]);
    const index = new ShelfIndex(harness.app, () => DEFAULT_SETTINGS);
    const view = new ShelfView(
      createFakeLeaf(harness.app),
      index,
      () => DEFAULT_SETTINGS,
    );
    await view.onOpen();
    const file = harness.file("page.html")!;
    file.path = "moved.html";
    view.contentEl.querySelector<HTMLButtonElement>(".hs-entry")?.click();
    await Promise.resolve();
    expect(noticeMessages).toEqual(["File no longer exists: page.html"]);
  });

  it("debounces search, preserves scroll, restores entries, and distinguishes no results", async () => {
    vi.useFakeTimers();
    const harness = createFakeApp([
      { path: "alpha.html", content: "<title>Alpha plan</title>" },
      { path: "beta.html", content: "<title>Beta notes</title>" },
    ]);
    const index = new ShelfIndex(harness.app, () => DEFAULT_SETTINGS);
    const view = new ShelfView(
      createFakeLeaf(harness.app),
      index,
      () => DEFAULT_SETTINGS,
    );
    await view.onOpen();
    const input = view.contentEl.querySelector<HTMLInputElement>(".hs-search")!;
    const list = view.contentEl.querySelector<HTMLElement>(".hs-sections")!;
    list.scrollTop = 64;

    input.value = "alpha";
    input.dispatchEvent(new Event("input"));
    expect(view.contentEl.querySelectorAll(".hs-entry")).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(100);
    expect(view.contentEl.querySelectorAll(".hs-entry")).toHaveLength(1);
    expect(view.contentEl.textContent).toContain("Alpha plan");
    expect(list.scrollTop).toBe(64);

    input.value = "missing";
    input.dispatchEvent(new Event("input"));
    await vi.advanceTimersByTimeAsync(100);
    expect(view.contentEl.querySelector(".hs-no-results")?.textContent).toBe(
      "No pages match your filter.",
    );
    expect(view.contentEl.querySelector(".hs-empty")).toBeNull();

    input.value = "";
    input.dispatchEvent(new Event("input"));
    await vi.advanceTimersByTimeAsync(100);
    expect(view.contentEl.querySelectorAll(".hs-entry")).toHaveLength(2);
  });
});

describe("plugin shelf registration", () => {
  beforeEach(() => {
    registeredViews.splice(0);
    registeredCommands.splice(0);
    ribbonItems.splice(0);
  });

  it("registers the view, ribbon action, and command with sentence-case labels", () => {
    const harness = createFakeApp([]);
    const plugin = new HtmlShelfPlugin(harness.app, manifest);
    plugin.onload();
    expect(registeredViews.map(({ type }) => type)).toEqual([VIEW_TYPE_SHELF]);
    expect(ribbonItems.map(({ icon, title }) => ({ icon, title }))).toEqual([
      { icon: "library", title: "Open HTML shelf" },
    ]);
    expect(registeredCommands.map(({ id, name }) => ({ id, name }))).toEqual([
      { id: "open-shelf", name: "Open shelf" },
    ]);
  });

  it("reuses one shelf leaf across direct, ribbon, and command activation", async () => {
    const harness = createFakeApp([]);
    const plugin = new HtmlShelfPlugin(harness.app, manifest);
    plugin.onload();
    await plugin.activateShelf();
    await ribbonItems[0]?.callback();
    await registeredCommands[0]?.callback();
    expect(harness.leaves).toHaveLength(1);
    expect(harness.leaves[0]?.state).toEqual({
      type: VIEW_TYPE_SHELF,
      active: true,
    });
    expect(harness.revealedLeaves).toEqual([
      harness.leaves[0],
      harness.leaves[0],
      harness.leaves[0],
    ]);
  });
});
