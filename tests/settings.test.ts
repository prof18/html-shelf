import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PluginManifest } from "obsidian";
import HtmlShelfPlugin from "../src/main";
import { DEFAULT_SETTINGS } from "../src/core/model";
import { ShelfSettingTab } from "../src/settings";
import { createFakeApp } from "./mocks/fake-app";
import { registeredSettingTabs, settingRecords } from "./mocks/obsidian";

const manifest: PluginManifest = {
  id: "html-shelf",
  name: "HTML Shelf",
  author: "Marco Gomiero",
  version: "0.1.0",
  minAppVersion: "1.5.0",
  description: "Test manifest",
};

const flushChanges = async (): Promise<void> => {
  await new Promise((resolve) => window.setTimeout(resolve, 0));
};

describe("settings persistence", () => {
  it("defaults missing keys and preserves unknown data when saving", async () => {
    const harness = createFakeApp([]);
    const plugin = new HtmlShelfPlugin(harness.app, manifest);
    await plugin.saveData({
      includeFolders: ["plans"],
      legacyOption: "preserve-me",
    });

    await plugin.loadSettings();

    expect(plugin.settings).toEqual({
      ...DEFAULT_SETTINGS,
      includeFolders: ["plans"],
      legacyOption: "preserve-me",
    });
    const saveData = vi.spyOn(plugin, "saveData");
    plugin.settings.includeHtm = false;
    await plugin.saveSettings();
    expect(saveData).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      includeFolders: ["plans"],
      includeHtm: false,
      legacyOption: "preserve-me",
    });
  });

  it("notifies subscribers after persistence and supports unsubscribe", async () => {
    const harness = createFakeApp([]);
    const plugin = new HtmlShelfPlugin(harness.app, manifest);
    const listener = vi.fn();
    const unsubscribe = plugin.onSettingsChanged(listener);

    await plugin.saveSettings();
    expect(listener).toHaveBeenCalledOnce();

    unsubscribe();
    await plugin.saveSettings();
    expect(listener).toHaveBeenCalledOnce();
  });
});

describe("settings tab", () => {
  beforeEach(() => {
    registeredSettingTabs.splice(0);
    settingRecords.splice(0);
  });

  it("is registered during plugin loading", async () => {
    const harness = createFakeApp([]);
    const plugin = new HtmlShelfPlugin(harness.app, manifest);

    await plugin.onload();

    expect(registeredSettingTabs).toHaveLength(1);
    expect(registeredSettingTabs[0]).toBeInstanceOf(ShelfSettingTab);
  });

  it("renders sentence-case controls and normalizes folder lines", async () => {
    const harness = createFakeApp([
      { path: "plans/page.html", content: "<title>Plan</title>" },
      { path: "notes/deep/page.html", content: "<title>Note</title>" },
    ]);
    const plugin = new HtmlShelfPlugin(harness.app, manifest);
    const tab = new ShelfSettingTab(harness.app, plugin);
    tab.display();

    expect(tab.containerEl.textContent).toContain(
      "HTML Shelf lists every HTML file in the scope below.",
    );
    expect(settingRecords.map(({ name }) => name)).toEqual([
      "Folders to include",
      "Folders to exclude",
      "Include .htm files",
    ]);

    const include = settingRecords[0]!.textAreas[0]!;
    include.inputEl.value = "plans\n notes/deep \n\n";
    include.inputEl.dispatchEvent(new Event("input"));
    await flushChanges();

    expect(plugin.settings.includeFolders).toEqual(["plans", "notes/deep"]);
    expect(settingRecords[0]!.setting.descEl.textContent).not.toContain(
      "not found in this vault",
    );
  });

  it("keeps missing folders with an informational flag and saves toggle changes", async () => {
    const harness = createFakeApp([]);
    const plugin = new HtmlShelfPlugin(harness.app, manifest);
    const listener = vi.fn();
    plugin.onSettingsChanged(listener);
    const tab = new ShelfSettingTab(harness.app, plugin);
    tab.display();

    const exclude = settingRecords[1]!.textAreas[0]!;
    exclude.inputEl.value = "future/folder";
    exclude.inputEl.dispatchEvent(new Event("input"));
    await flushChanges();
    expect(plugin.settings.excludeFolders).toEqual(["future/folder"]);
    expect(settingRecords[1]!.setting.descEl.textContent).toContain(
      "future/folder — not found in this vault",
    );

    const toggle = settingRecords[2]!.toggles[0]!;
    toggle.toggleEl.checked = false;
    toggle.toggleEl.dispatchEvent(new Event("change"));
    await flushChanges();
    expect(plugin.settings.includeHtm).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
