import {
  normalizePath,
  PluginSettingTab,
  Setting,
  TFolder,
  type App,
} from "obsidian";
import type HtmlShelfPlugin from "./main";

export const normalizeFolderLines = (value: string): string[] =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => normalizePath(line));

export class ShelfSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly shelfPlugin: HtmlShelfPlugin,
  ) {
    super(app, shelfPlugin);
  }

  display(): void {
    this.containerEl.empty();
    const introduction = this.containerEl.createEl("p");
    introduction.append(
      "HTML Shelf lists every HTML file in the scope below. Folders can also provide curated titles and sections with an ",
    );
    introduction.createEl("code", { text: "html-shelf.json" });
    introduction.append(" file — see the plugin README.");

    this.addFolderSetting(
      "Folders to include",
      "Empty means the entire vault. Enter one vault-relative folder path per line.",
      "includeFolders",
    );
    this.addFolderSetting(
      "Folders to exclude",
      "Enter one vault-relative folder path per line. Excludes win over includes.",
      "excludeFolders",
    );
    new Setting(this.containerEl)
      .setName("Include .htm files")
      .setDesc(
        "Show .htm files in the shelf listing. Files opened directly still render when this is off.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.shelfPlugin.settings.includeHtm)
          .onChange(async (value) => {
            this.shelfPlugin.settings.includeHtm = value;
            await this.shelfPlugin.saveSettings();
          }),
      );
  }

  private addFolderSetting(
    name: string,
    description: string,
    key: "includeFolders" | "excludeFolders",
  ): void {
    const setting = new Setting(this.containerEl).setName(name);
    const updateDescription = (paths: string[]): void => {
      setting.setDesc(description);
      const missing = paths.filter(
        (path) =>
          !(this.app.vault.getAbstractFileByPath(path) instanceof TFolder),
      );
      for (const path of missing) {
        setting.descEl.createDiv({
          cls: "hs-folder-status",
          text: `${path} — not found in this vault`,
        });
      }
    };
    const initial = this.shelfPlugin.settings[key];
    updateDescription(initial);
    setting.addTextArea((textArea) =>
      textArea
        .setPlaceholder("folder/path")
        .setValue(initial.join("\n"))
        .onChange(async (value) => {
          const paths = normalizeFolderLines(value);
          this.shelfPlugin.settings[key] = paths;
          updateDescription(paths);
          await this.shelfPlugin.saveSettings();
        }),
    );
  }
}
