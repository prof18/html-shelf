import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Platform, type PluginManifest } from "obsidian";
import HtmlShelfPlugin from "../../src/main";
import { DEFAULT_SETTINGS } from "../../src/core/model";
import { HtmlView } from "../../src/views/HtmlView";
import { ShelfIndex } from "../../src/views/ShelfIndex";
import { ShelfView } from "../../src/views/ShelfView";
import { VIEW_TYPE_HTML, VIEW_TYPE_SHELF } from "../../src/views/view-types";
import {
  attachFileView,
  createFakeApp,
  createFakeLeaf,
} from "../mocks/fake-app";
import {
  noticeMessages,
  registeredCommands,
  registeredExtensions,
  registeredViews,
  ribbonItems,
  setRegisterExtensionsError,
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
  afterEach(() => {
    Platform.isMobile = false;
    vi.useRealTimers();
  });

  it("marks the shelf as mobile from Obsidian's platform API", async () => {
    Platform.isMobile = true;
    const harness = createFakeApp([]);
    const index = new ShelfIndex(harness.app, () => DEFAULT_SETTINGS);
    const view = new ShelfView(
      createFakeLeaf(harness.app),
      index,
      () => DEFAULT_SETTINGS,
    );

    await view.onOpen();

    expect(view.contentEl.querySelector(".hs-shelf")?.classList).toContain(
      "hs-mobile",
    );
  });

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

  it("forces the HTML view when extension registration is unavailable", async () => {
    const harness = createFakeApp([
      { path: "page.html", content: "<title>Page</title>" },
    ]);
    const index = new ShelfIndex(harness.app, () => DEFAULT_SETTINGS);
    const view = new ShelfView(
      createFakeLeaf(harness.app),
      index,
      () => DEFAULT_SETTINGS,
      () => false,
    );
    await view.onOpen();

    view.contentEl.querySelector<HTMLButtonElement>(".hs-entry")?.click();
    await Promise.resolve();

    expect(harness.leaves).toHaveLength(1);
    expect(harness.leaves[0]?.openedFiles).toHaveLength(0);
    expect(harness.leaves[0]?.state).toEqual({
      type: VIEW_TYPE_HTML,
      state: { file: "page.html" },
    });
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

  it("refreshes for HTML changes, ignores markdown modifies, and preserves query and scroll", async () => {
    vi.useFakeTimers();
    const harness = createFakeApp([
      { path: "alpha.html", content: "<title>Alpha</title>" },
      { path: "note.md", content: "Markdown" },
    ]);
    class CountingIndex extends ShelfIndex {
      builds = 0;

      override async build() {
        this.builds += 1;
        return super.build();
      }
    }
    const index = new CountingIndex(harness.app, () => DEFAULT_SETTINGS);
    const view = new ShelfView(
      createFakeLeaf(harness.app),
      index,
      () => DEFAULT_SETTINGS,
    );
    await view.onOpen();
    expect(index.builds).toBe(1);

    harness.modifyFile("note.md", "Changed markdown");
    await vi.advanceTimersByTimeAsync(300);
    expect(index.builds).toBe(1);

    harness.createFile({ path: "beta.html", content: "<title>Beta</title>" });
    await vi.advanceTimersByTimeAsync(249);
    expect(index.builds).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(index.builds).toBe(2);
    expect(view.contentEl.textContent).toContain("Beta");

    const input = view.contentEl.querySelector<HTMLInputElement>(".hs-search")!;
    const list = view.contentEl.querySelector<HTMLElement>(".hs-sections")!;
    input.value = "beta";
    input.dispatchEvent(new Event("input"));
    await vi.advanceTimersByTimeAsync(100);
    list.scrollTop = 72;
    harness.renameFile("alpha.html", "renamed.html");
    await vi.advanceTimersByTimeAsync(250);
    expect(input.value).toBe("beta");
    expect(list.scrollTop).toBe(72);
    expect(view.contentEl.querySelectorAll(".hs-entry")).toHaveLength(1);
    expect(view.contentEl.textContent).toContain("beta.html");
    expect(view.contentEl.textContent).not.toContain("renamed.html");
  });

  it("rebuilds through the existing debounce when settings change", async () => {
    vi.useFakeTimers();
    const harness = createFakeApp([
      { path: "alpha.html", content: "<title>Alpha</title>" },
    ]);
    const index = new ShelfIndex(harness.app, () => DEFAULT_SETTINGS);
    const build = vi.spyOn(index, "build");
    const settingsSubscription: { callback: (() => void) | null } = {
      callback: null,
    };
    const view = new ShelfView(
      createFakeLeaf(harness.app),
      index,
      () => DEFAULT_SETTINGS,
      () => true,
      (callback) => {
        settingsSubscription.callback = callback;
        return () => {
          settingsSubscription.callback = null;
        };
      },
    );
    await view.onOpen();
    expect(build).toHaveBeenCalledOnce();

    settingsSubscription.callback?.();
    await vi.advanceTimersByTimeAsync(249);
    expect(build).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect(build).toHaveBeenCalledTimes(2);

    view.unload();
    expect(settingsSubscription.callback).toBeNull();
  });

  it("removes deleted HTML rows and notices html-to-text renames", async () => {
    vi.useFakeTimers();
    const harness = createFakeApp([
      { path: "alpha.html", content: "<title>Alpha</title>" },
      { path: "beta.html", content: "<title>Beta</title>" },
    ]);
    const index = new ShelfIndex(harness.app, () => DEFAULT_SETTINGS);
    const view = new ShelfView(
      createFakeLeaf(harness.app),
      index,
      () => DEFAULT_SETTINGS,
    );
    await view.onOpen();
    harness.deleteFile("beta.html");
    await vi.advanceTimersByTimeAsync(250);
    expect(view.contentEl.textContent).not.toContain("beta.html");
    harness.renameFile("alpha.html", "alpha.txt");
    await vi.advanceTimersByTimeAsync(250);
    expect(view.contentEl.querySelectorAll(".hs-entry")).toHaveLength(0);
  });
});

describe("plugin shelf registration", () => {
  beforeEach(() => {
    registeredViews.splice(0);
    registeredCommands.splice(0);
    registeredExtensions.splice(0);
    ribbonItems.splice(0);
    noticeMessages.splice(0);
    setRegisterExtensionsError(null);
  });

  it("registers the view, ribbon action, and command with sentence-case labels", () => {
    const harness = createFakeApp([]);
    const plugin = new HtmlShelfPlugin(harness.app, manifest);
    void plugin.onload();
    expect(registeredViews.map(({ type }) => type)).toEqual([
      VIEW_TYPE_SHELF,
      VIEW_TYPE_HTML,
    ]);
    expect(registeredExtensions).toEqual([
      { extensions: ["html", "htm"], viewType: VIEW_TYPE_HTML },
    ]);
    expect(plugin.extensionsRegistered).toBe(true);
    const htmlFactory = registeredViews.find(
      ({ type }) => type === VIEW_TYPE_HTML,
    )!;
    const htmlView = htmlFactory.creator(new MockWorkspaceLeaf(harness.app));
    expect(htmlView).toBeInstanceOf(HtmlView);
    expect((htmlView as HtmlView).plugin).toBe(plugin);
    expect(ribbonItems.map(({ icon, title }) => ({ icon, title }))).toEqual([
      { icon: "library", title: "Open HTML shelf" },
    ]);
    expect(registeredCommands.map(({ id, name }) => ({ id, name }))).toEqual([
      { id: "open-shelf", name: "Open shelf" },
      { id: "open-page-back", name: "Go back in page history" },
    ]);
  });

  it("keeps the shelf usable and shows one notice when extensions are claimed", () => {
    setRegisterExtensionsError(new Error("already registered"));
    const harness = createFakeApp([]);
    const plugin = new HtmlShelfPlugin(harness.app, manifest);

    void plugin.onload();
    void plugin.onload();

    expect(plugin.extensionsRegistered).toBe(false);
    expect(registeredExtensions).toEqual([]);
    expect(noticeMessages).toEqual([
      "HTML Shelf could not register as the HTML file viewer — another plugin already handles HTML files. The shelf will still open pages.",
    ]);
  });

  it("reuses one shelf leaf across direct, ribbon, and command activation", async () => {
    const harness = createFakeApp([]);
    const plugin = new HtmlShelfPlugin(harness.app, manifest);
    await plugin.onload();
    await plugin.activateShelf();
    await ribbonItems[0]?.callback();
    await registeredCommands[0]?.callback?.();
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

  it("guards the page-back command by the active HTML view", () => {
    const harness = createFakeApp([
      { path: "page.html", content: "<title>Page</title>" },
    ]);
    const plugin = new HtmlShelfPlugin(harness.app, manifest);
    void plugin.onload();
    const command = registeredCommands.find(
      ({ id }) => id === "open-page-back",
    )!;
    expect(command.checkCallback?.(true)).toBe(false);

    const leaf = harness.app.workspace.getLeaf(true);
    const view = new HtmlView(leaf, plugin);
    (leaf as unknown as MockWorkspaceLeaf).view = view;
    const goBack = vi.spyOn(view, "goBack").mockResolvedValue(undefined);

    expect(command.checkCallback?.(true)).toBe(true);
    expect(goBack).not.toHaveBeenCalled();
    expect(command.checkCallback?.(false)).toBe(true);
    expect(goBack).toHaveBeenCalledOnce();
  });
});
