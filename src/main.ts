import { Notice, Plugin } from "obsidian";
import { DEFAULT_SETTINGS, type ShelfSettings } from "./core/model";
import { ShelfSettingTab } from "./settings";
import { HtmlView } from "./views/HtmlView";
import { ShelfIndex } from "./views/ShelfIndex";
import { ShelfView } from "./views/ShelfView";
import { VIEW_TYPE_HTML, VIEW_TYPE_SHELF } from "./views/view-types";

export default class HtmlShelfPlugin extends Plugin {
  settings: ShelfSettings & Record<string, unknown> = { ...DEFAULT_SETTINGS };
  extensionsRegistered = false;
  private extensionConflictNoticed = false;
  private readonly settingsListeners = new Set<() => void>();

  onload(): Promise<void> {
    const settingsLoaded = this.loadSettings();
    const index = new ShelfIndex(this.app, () => this.settings);
    this.registerView(
      VIEW_TYPE_SHELF,
      (leaf) =>
        new ShelfView(
          leaf,
          index,
          () => this.settings,
          () => this.extensionsRegistered,
          (callback) => this.onSettingsChanged(callback),
        ),
    );
    this.registerView(VIEW_TYPE_HTML, (leaf) => new HtmlView(leaf, this));
    try {
      this.registerExtensions(["html", "htm"], VIEW_TYPE_HTML);
      this.extensionsRegistered = true;
    } catch {
      this.extensionsRegistered = false;
      if (!this.extensionConflictNoticed) {
        this.extensionConflictNoticed = true;
        new Notice(
          "HTML shelf could not register as the HTML file viewer — another plugin already handles HTML files. The shelf will still open pages.",
        );
      }
    }
    this.addRibbonIcon("library", "Open HTML shelf", () =>
      this.activateShelf(),
    );
    this.addCommand({
      id: "open-shelf",
      name: "Open shelf",
      callback: () => this.activateShelf(),
    });
    this.addCommand({
      id: "open-page-back",
      name: "Go back in page history",
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(HtmlView);
        if (!view) return false;
        if (!checking) void view.goBack();
        return true;
      },
    });
    this.registerEvent(
      this.app.workspace.on("css-change", () => {
        const theme = document.body.classList.contains("theme-dark")
          ? "dark"
          : "light";
        for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_HTML)) {
          if (leaf.view instanceof HtmlView) leaf.view.updateTheme(theme);
        }
      }),
    );
    this.addSettingTab(new ShelfSettingTab(this.app, this));
    return settingsLoaded;
  }

  async loadSettings(): Promise<void> {
    const saved: unknown = await this.loadData();
    const savedRecord: Record<string, unknown> =
      typeof saved === "object" && saved !== null && !Array.isArray(saved)
        ? (saved as Record<string, unknown>)
        : {};
    this.settings = Object.assign({}, DEFAULT_SETTINGS, savedRecord);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    for (const listener of this.settingsListeners) listener();
  }

  onSettingsChanged(callback: () => void): () => void {
    this.settingsListeners.add(callback);
    return () => this.settingsListeners.delete(callback);
  }

  async activateShelf(): Promise<void> {
    const leaf =
      this.app.workspace.getLeavesOfType(VIEW_TYPE_SHELF)[0] ??
      this.app.workspace.getLeaf(true);
    await leaf.setViewState({ type: VIEW_TYPE_SHELF, active: true });
    this.app.workspace.setActiveLeaf(leaf, { focus: true });
  }
}
