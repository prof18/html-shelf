import { ItemView, type WorkspaceLeaf } from "obsidian";
import type { ShelfIndex } from "./ShelfIndex";
import { VIEW_TYPE_SHELF } from "./view-types";

export class ShelfView extends ItemView {
  constructor(
    leaf: WorkspaceLeaf,
    private readonly index: ShelfIndex,
  ) {
    super(leaf);
    void this.index;
  }

  getViewType(): string {
    return VIEW_TYPE_SHELF;
  }

  getDisplayText(): string {
    return "HTML shelf";
  }

  getIcon(): string {
    return "library";
  }
}
