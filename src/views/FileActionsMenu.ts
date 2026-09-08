import { Menu, Notice, TFile, type App } from "obsidian";
import { DeleteConfirmationModal } from "./DeleteConfirmationModal";

export const createFileActionsMenu = (
  app: App,
  path: string,
  onReload?: () => void,
): Menu => {
  const menu = new Menu();
  if (onReload) {
    menu.addItem((item) =>
      item.setTitle("Reload").setIcon("refresh-cw").onClick(onReload),
    );
  }
  menu.addItem((item) =>
    item
      .setTitle("Copy path")
      .setIcon("copy")
      .onClick(() => {
        void copyFilePath(path);
      }),
  );
  menu.addItem((item) =>
    item
      .setTitle("Delete")
      .setIcon("trash-2")
      .setWarning(true)
      .onClick(() => {
        new DeleteConfirmationModal(app, path, () => {
          void deleteFile(app, path);
        }).open();
      }),
  );
  return menu;
};

const copyFilePath = async (path: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(path);
    new Notice(`Copied path: ${path}`);
  } catch {
    new Notice(`Could not copy path: ${path}`);
  }
};

const deleteFile = async (app: App, path: string): Promise<void> => {
  const file = app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) {
    new Notice(`File no longer exists: ${path}`);
    return;
  }

  try {
    await app.fileManager.trashFile(file);
    new Notice(`Deleted: ${path}`);
  } catch {
    new Notice(`Could not delete: ${path}`);
  }
};
