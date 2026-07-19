import type { App, WorkspaceLeaf as RealWorkspaceLeaf } from "obsidian";
import { TFile as MockTFile, WorkspaceLeaf } from "./obsidian";

export interface FakeFileInput {
  path: string;
  content: string;
  mtime?: number;
}

export interface FakeAppHarness {
  app: App;
  leaves: WorkspaceLeaf[];
  revealedLeaves: WorkspaceLeaf[];
  readCount: (path: string) => number;
  setContent: (path: string, content: string) => void;
  setMtime: (path: string, mtime: number) => void;
}

export function createFakeApp(inputs: FakeFileInput[]): FakeAppHarness {
  const records = new Map(
    inputs.map((input) => {
      const file = new MockTFile();
      file.path = input.path;
      file.name = input.path.slice(input.path.lastIndexOf("/") + 1);
      const dot = file.name.lastIndexOf(".");
      file.extension = dot === -1 ? "" : file.name.slice(dot + 1);
      file.basename = dot === -1 ? file.name : file.name.slice(0, dot);
      file.stat.mtime = input.mtime ?? 1;
      file.stat.size = input.content.length;
      return [input.path, { file, content: input.content, reads: 0 }] as [
        string,
        { file: MockTFile; content: string; reads: number },
      ];
    }),
  );

  const vault = {
    getFiles: () => [...records.values()].map((record) => record.file),
    cachedRead: (file: MockTFile) => {
      const record = records.get(file.path);
      if (!record)
        return Promise.reject(new Error(`Missing fake file: ${file.path}`));
      record.reads += 1;
      return Promise.resolve(record.content);
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
  };
  appValue.workspace = workspace;

  return {
    app: appValue as unknown as App,
    leaves,
    revealedLeaves,
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
