import { Plugin } from "obsidian";
import { DEFAULT_SETTINGS } from "./core/model";
import { ShelfIndex } from "./views/ShelfIndex";
import { ShelfView } from "./views/ShelfView";
import { VIEW_TYPE_SHELF } from "./views/view-types";

export default class HtmlShelfPlugin extends Plugin {
  onload(): void {
    const index = new ShelfIndex(this.app, () => DEFAULT_SETTINGS);
    this.registerView(
      VIEW_TYPE_SHELF,
      (leaf) => new ShelfView(leaf, index, () => DEFAULT_SETTINGS),
    );
    this.addRibbonIcon("library", "Open HTML shelf", () =>
      this.activateShelf(),
    );
    this.addCommand({
      id: "open-shelf",
      name: "Open shelf",
      callback: () => this.activateShelf(),
    });
  }

  async activateShelf(): Promise<void> {
    const leaf =
      this.app.workspace.getLeavesOfType(VIEW_TYPE_SHELF)[0] ??
      this.app.workspace.getLeaf(true);
    await leaf.setViewState({ type: VIEW_TYPE_SHELF, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }
}
