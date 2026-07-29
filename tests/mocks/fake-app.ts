import type { App, WorkspaceLeaf as RealWorkspaceLeaf } from "obsidian";
import { FileView, TFile as MockTFile, WorkspaceLeaf } from "./obsidian";

export interface FakeFileInput {
  path: string;
  content: string;
  mtime?: number;
}

export interface FakeAppHarness {
  app: App;
  leaves: WorkspaceLeaf[];
  revealedLeaves: WorkspaceLeaf[];
  file: (path: string) => MockTFile | null;
  createFile: (input: FakeFileInput) => void;
  deleteFile: (path: string) => void;
  modifyFile: (path: string, content: string) => void;
  renameFile: (oldPath: string, newPath: string) => void;
  readCount: (path: string) => number;
  setContent: (path: string, content: string) => void;
  setMtime: (path: string, mtime: number) => void;
}

export function createFakeApp(inputs: FakeFileInput[]): FakeAppHarness {
  const setFilePath = (file: MockTFile, path: string): void => {
    file.path = path;
    file.name = path.slice(path.lastIndexOf("/") + 1);
    const dot = file.name.lastIndexOf(".");
    file.extension = dot === -1 ? "" : file.name.slice(dot + 1);
    file.basename = dot === -1 ? file.name : file.name.slice(0, dot);
  };
  const makeRecord = (input: FakeFileInput) => {
    const file = new MockTFile();
    setFilePath(file, input.path);
    file.stat.mtime = input.mtime ?? 1;
    file.stat.size = input.content.length;
    return { file, content: input.content, reads: 0 };
  };
  const records = new Map(
    inputs.map(
      (input) =>
        [input.path, makeRecord(input)] as [
          string,
          { file: MockTFile; content: string; reads: number },
        ],
    ),
  );

  type VaultHandler = (file: MockTFile, oldPath?: string) => void;
  const handlers = new Map<string, Set<VaultHandler>>();
  const emit = (event: string, file: MockTFile, oldPath?: string): void => {
    for (const handler of handlers.get(event) ?? []) handler(file, oldPath);
  };

  const vault = {
    adapter: {
      getResourcePath: (path: string) => `app://vault/${path}`,
    },
    getFiles: () => [...records.values()].map((record) => record.file),
    cachedRead: (file: MockTFile) => {
      const record = records.get(file.path);
      if (!record)
        return Promise.reject(new Error(`Missing fake file: ${file.path}`));
      record.reads += 1;
      return Promise.resolve(record.content);
    },
    getAbstractFileByPath: (path: string) => {
      const file = records.get(path)?.file;
      return file?.path === path ? file : null;
    },
    on: (event: string, handler: VaultHandler) => {
      const eventHandlers = handlers.get(event) ?? new Set<VaultHandler>();
      eventHandlers.add(handler);
      handlers.set(event, eventHandlers);
      return { off: () => eventHandlers.delete(handler) };
    },
  };

  const leaves: WorkspaceLeaf[] = [];
  const revealedLeaves: WorkspaceLeaf[] = [];
  const appValue: { vault: typeof vault; workspace: object } = {
    vault,
    workspace: {},
  };
  const workspace = {
    getLeavesOfType: (type: string) =>
      leaves.filter((leaf) => leaf.state.type === type),
    getLeaf: () => {
      const leaf = new WorkspaceLeaf(appValue);
      leaves.push(leaf);
      return leaf;
    },
    revealLeaf: (leaf: WorkspaceLeaf) => {
      revealedLeaves.push(leaf);
      return Promise.resolve();
    },
    getActiveViewOfType: <T>(type: { prototype: T }): T | null => {
      const leaf = [...leaves].reverse().find(({ view }) => {
        if (
          view === null ||
          (typeof view !== "object" && typeof view !== "function")
        ) {
          return false;
        }
        return Object.prototype.isPrototypeOf.call(type.prototype, view);
      });
      return (leaf?.view as T | undefined) ?? null;
    },
  };
  appValue.workspace = workspace;

  return {
    app: appValue as unknown as App,
    leaves,
    revealedLeaves,
    file: (path) => records.get(path)?.file ?? null,
    createFile: (input) => {
      const record = makeRecord(input);
      records.set(input.path, record);
      emit("create", record.file);
    },
    deleteFile: (path) => {
      const record = records.get(path);
      if (!record) throw new Error(`Missing fake file: ${path}`);
      records.delete(path);
      emit("delete", record.file);
    },
    modifyFile: (path, content) => {
      const record = records.get(path);
      if (!record) throw new Error(`Missing fake file: ${path}`);
      record.content = content;
      record.file.stat.size = content.length;
      record.file.stat.mtime += 1;
      emit("modify", record.file);
    },
    renameFile: (oldPath, newPath) => {
      const record = records.get(oldPath);
      if (!record) throw new Error(`Missing fake file: ${oldPath}`);
      records.delete(oldPath);
      setFilePath(record.file, newPath);
      records.set(newPath, record);
      emit("rename", record.file, oldPath);
    },
    readCount: (path) => records.get(path)?.reads ?? 0,
    setContent: (path, content) => {
      const record = records.get(path);
      if (!record) throw new Error(`Missing fake file: ${path}`);
      record.content = content;
      record.file.stat.size = content.length;
    },
    setMtime: (path, mtime) => {
      const record = records.get(path);
      if (!record) throw new Error(`Missing fake file: ${path}`);
      record.file.stat.mtime = mtime;
    },
  };
}

export function createFakeLeaf(app: App): RealWorkspaceLeaf {
  return new WorkspaceLeaf(app) as unknown as RealWorkspaceLeaf;
}

export function attachFileView(leaf: RealWorkspaceLeaf, file: MockTFile): void {
  const mockLeaf = leaf as unknown as WorkspaceLeaf;
  const view = new FileView(mockLeaf);
  view.file = file;
  mockLeaf.view = view;
}
