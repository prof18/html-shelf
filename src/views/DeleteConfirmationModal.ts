import { Modal, type App } from "obsidian";

export class DeleteConfirmationModal extends Modal {
  constructor(
    app: App,
    private readonly path: string,
    private readonly onConfirm: () => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText("Delete HTML file?");
    this.contentEl.createEl("p", {
      cls: "hs-delete-message",
      text: `Delete “${this.path}” from this vault? Obsidian will use your deleted-files preference.`,
    });

    const actions = this.contentEl.createDiv({
      cls: "modal-button-container",
    });
    const cancel = actions.createEl("button", {
      text: "Cancel",
      attr: { type: "button" },
    });
    const confirm = actions.createEl("button", {
      text: "Delete",
      attr: { type: "button" },
    });
    confirm.classList.add("mod-warning");

    cancel.addEventListener("click", () => this.close());
    confirm.addEventListener("click", () => {
      this.close();
      this.onConfirm();
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
