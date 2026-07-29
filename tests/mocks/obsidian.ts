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

const applyElementOptions = (
  element: HTMLElement,
  options?:
    string | { cls?: string; text?: string; attr?: Record<string, string> },
): void => {
  if (typeof options === "string") element.className = options;
  else if (options) {
    if (options.cls) element.className = options.cls;
    if (options.text) element.textContent = options.text;
    for (const [name, value] of Object.entries(options.attr ?? {})) {
      element.setAttribute(name, value);
    }
  }
};

Object.defineProperties(HTMLElement.prototype, {
  empty: {
    value(this: HTMLElement): void {
      this.replaceChildren();
    },
  },
  createDiv: {
    value(
      this: HTMLElement,
      options?:
        string | { cls?: string; text?: string; attr?: Record<string, string> },
    ): HTMLDivElement {
      const element = document.createElement("div");
      applyElementOptions(element, options);
      this.append(element);
      return element;
    },
  },
  createEl: {
    value(
      this: HTMLElement,
      tag: keyof HTMLElementTagNameMap,
      options?:
        string | { cls?: string; text?: string; attr?: Record<string, string> },
    ): HTMLElement {
      const element = document.createElement(tag);
      applyElementOptions(element, options);
      this.append(element);
      return element;
    },
  },
});

const hasOff = (value: unknown): value is { off: () => void } =>
  typeof value === "object" &&
  value !== null &&
  typeof Reflect.get(value, "off") === "function";

export class Component {
  private readonly cleanup: (() => void)[] = [];

  register(callback: () => void): void {
    this.cleanup.push(callback);
  }

  registerEvent(event: unknown): void {
    if (hasOff(event)) this.cleanup.push(() => event.off());
  }

  registerDomEvent(
    element: EventTarget,
    event: string,
    callback: EventListener,
  ): void {
    element.addEventListener(event, callback);
  }

  load(): void {}
  unload(): void {
    for (const callback of this.cleanup.splice(0)) callback();
  }
}

export class WorkspaceLeaf {
  view: unknown = null;
  state: {
    type: string;
    active?: boolean;
    state?: Record<string, unknown>;
  } = { type: "empty" };
  openedFiles: TFile[] = [];

  constructor(public app: unknown = {}) {}

  setViewState(state: {
    type: string;
    active?: boolean;
    state?: Record<string, unknown>;
  }): Promise<void> {
    this.state = state;
    return Promise.resolve();
  }

  openFile(file: TFile): Promise<void> {
    this.openedFiles.push(file);
    return Promise.resolve();
  }
}

export class ItemView extends Component {
  app: unknown;
  leaf: WorkspaceLeaf;
  containerEl: HTMLElement;
  contentEl: HTMLElement;

  constructor(leaf: WorkspaceLeaf) {
    super();
    this.leaf = leaf;
    this.app = leaf.app;
    this.containerEl = document.createElement("div");
    this.contentEl = document.createElement("div");
    this.containerEl.append(this.contentEl);
  }

  onOpen(): Promise<void> {
    return Promise.resolve();
  }

  onClose(): Promise<void> {
    return Promise.resolve();
  }
}

export class FileView extends ItemView {
  allowNoFile = false;
  file: TFile | null = null;

  onLoadFile(file: TFile): Promise<void> {
    this.file = file;
    return Promise.resolve();
  }

  onUnloadFile(file: TFile): Promise<void> {
    if (this.file === file) this.file = null;
    return Promise.resolve();
  }

  getState(): Record<string, unknown> {
    return this.file ? { file: this.file.path } : {};
  }

  setState(
    state: Record<string, unknown>,
    result: { history: boolean },
  ): Promise<void> {
    void result;
    const path = state.file;
    const app = this.app as {
      vault?: { getAbstractFileByPath?: (path: string) => unknown };
    };
    const file =
      typeof path === "string"
        ? app.vault?.getAbstractFileByPath?.(path)
        : null;
    this.file = file instanceof TFile ? file : null;
    return Promise.resolve();
  }
}

export const registeredViews: {
  type: string;
  creator: (leaf: WorkspaceLeaf) => unknown;
}[] = [];
export const ribbonItems: {
  icon: string;
  title: string;
  callback: () => unknown;
}[] = [];
export const registeredCommands: {
  id: string;
  name: string;
  callback?: () => unknown;
  checkCallback?: (checking: boolean) => boolean | void;
}[] = [];
export const registeredExtensions: {
  extensions: string[];
  viewType: string;
}[] = [];
export const registeredSettingTabs: PluginSettingTab[] = [];
let registerExtensionsError: Error | null = null;

export const setRegisterExtensionsError = (error: Error | null): void => {
  registerExtensionsError = error;
};

export class Plugin extends Component {
  private data: unknown = null;

  constructor(
    public app: unknown,
    public manifest: unknown,
  ) {
    super();
  }

  registerView(type: string, creator: (leaf: WorkspaceLeaf) => unknown): void {
    registeredViews.push({ type, creator });
  }

  registerExtensions(extensions: string[], viewType: string): void {
    if (registerExtensionsError) throw registerExtensionsError;
    registeredExtensions.push({ extensions, viewType });
  }

  addRibbonIcon(
    icon: string,
    title: string,
    callback: () => unknown,
  ): HTMLElement {
    ribbonItems.push({ icon, title, callback });
    return document.createElement("div");
  }

  addCommand(command: {
    id: string;
    name: string;
    callback?: () => unknown;
    checkCallback?: (checking: boolean) => boolean | void;
  }): typeof command {
    registeredCommands.push(command);
    return command;
  }

  addSettingTab(settingTab: PluginSettingTab): void {
    registeredSettingTabs.push(settingTab);
  }

  loadData(): Promise<unknown> {
    return Promise.resolve(this.data);
  }

  saveData(data: unknown): Promise<void> {
    this.data = data;
    return Promise.resolve();
  }
}

export class PluginSettingTab {
  containerEl = document.createElement("div");

  constructor(
    public app: unknown,
    public plugin: Plugin,
  ) {}
}

export class TextAreaComponent {
  inputEl = document.createElement("textarea");
  private changeCallback: ((value: string) => unknown) | null = null;

  constructor(containerEl: HTMLElement) {
    containerEl.append(this.inputEl);
    this.inputEl.addEventListener("input", () => {
      void this.changeCallback?.(this.inputEl.value);
    });
  }

  setPlaceholder(value: string): this {
    this.inputEl.placeholder = value;
    return this;
  }

  setValue(value: string): this {
    this.inputEl.value = value;
    return this;
  }

  onChange(callback: (value: string) => unknown): this {
    this.changeCallback = callback;
    return this;
  }
}

export class ToggleComponent {
  toggleEl = document.createElement("input");
  private changeCallback: ((value: boolean) => unknown) | null = null;

  constructor(containerEl: HTMLElement) {
    this.toggleEl.type = "checkbox";
    containerEl.append(this.toggleEl);
    this.toggleEl.addEventListener("change", () => {
      void this.changeCallback?.(this.toggleEl.checked);
    });
  }

  setValue(value: boolean): this {
    this.toggleEl.checked = value;
    return this;
  }

  onChange(callback: (value: boolean) => unknown): this {
    this.changeCallback = callback;
    return this;
  }
}

export interface SettingRecord {
  setting: Setting;
  name: string;
  description: string;
  textAreas: TextAreaComponent[];
  toggles: ToggleComponent[];
}

export const settingRecords: SettingRecord[] = [];

export class Setting {
  settingEl = document.createElement("div");
  infoEl = document.createElement("div");
  nameEl = document.createElement("div");
  descEl = document.createElement("div");
  controlEl = document.createElement("div");
  private readonly record: SettingRecord;

  constructor(containerEl: HTMLElement) {
    this.settingEl.className = "setting-item";
    this.infoEl.append(this.nameEl, this.descEl);
    this.settingEl.append(this.infoEl, this.controlEl);
    containerEl.append(this.settingEl);
    this.record = {
      setting: this,
      name: "",
      description: "",
      textAreas: [],
      toggles: [],
    };
    settingRecords.push(this.record);
  }

  setName(name: string | DocumentFragment): this {
    this.nameEl.replaceChildren();
    this.nameEl.append(name);
    this.record.name = this.nameEl.textContent ?? "";
    return this;
  }

  setDesc(description: string | DocumentFragment): this {
    this.descEl.replaceChildren();
    this.descEl.append(description);
    this.record.description = this.descEl.textContent ?? "";
    return this;
  }

  setClass(className: string): this {
    this.settingEl.classList.add(className);
    return this;
  }

  addTextArea(callback: (component: TextAreaComponent) => unknown): this {
    const component = new TextAreaComponent(this.controlEl);
    this.record.textAreas.push(component);
    callback(component);
    return this;
  }

  addToggle(callback: (component: ToggleComponent) => unknown): this {
    const component = new ToggleComponent(this.controlEl);
    this.record.toggles.push(component);
    callback(component);
    return this;
  }
}

export const setIcon = (element: HTMLElement, icon: string): void => {
  void element;
  void icon;
};

export const Platform = {
  isAndroidApp: false,
  isIosApp: false,
  isMobile: false,
};
