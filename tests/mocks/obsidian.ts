export class TFile {
  path = "";
  extension = "";
  basename = "";
  name = "";
  stat = { ctime: 0, mtime: 0, size: 0 };
}

export class TFolder {
  path = "";
  children: unknown[] = [];
}

export const noticeMessages: string[] = [];

export class Notice {
  constructor(public message: string) {
    noticeMessages.push(message);
  }
}

export const normalizePath = (path: string): string =>
  path
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/^\/|\/$/g, "");

export class Component {
  register(callback: () => void): void {
    void callback;
  }

  registerEvent(event: unknown): void {
    void event;
  }

  registerDomEvent(
    element: EventTarget,
    event: string,
    callback: EventListener,
  ): void {
    element.addEventListener(event, callback);
  }

  load(): void {}
  unload(): void {}
}

export class ItemView extends Component {}

export class FileView extends ItemView {
  file: TFile | null = null;
}

export class Plugin extends Component {}

export class PluginSettingTab {}

export class Setting {}

export const setIcon = (element: HTMLElement, icon: string): void => {
  void element;
  void icon;
};

export const Platform = { isMobile: false };
