import { beforeEach, describe, expect, it } from "vitest";
import type { PluginManifest } from "obsidian";
import HtmlShelfPlugin from "../../src/main";
import { DEFAULT_SETTINGS } from "../../src/core/model";
import { ShelfIndex } from "../../src/views/ShelfIndex";
import { ShelfView } from "../../src/views/ShelfView";
import { VIEW_TYPE_SHELF } from "../../src/views/view-types";
import { createFakeApp, createFakeLeaf } from "../mocks/fake-app";
import {
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
    const view = new ShelfView(createFakeLeaf(harness.app), index);
    expect(view.getViewType()).toBe(VIEW_TYPE_SHELF);
    expect(view.getDisplayText()).toBe("HTML shelf");
    expect(view.getIcon()).toBe("library");
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
