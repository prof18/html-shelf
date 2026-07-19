import type { App } from "obsidian";
import { TFile as MockTFile } from "./obsidian";

export interface FakeFileInput {
  path: string;
  content: string;
  mtime?: number;
}

export interface FakeAppHarness {
  app: App;
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

  return {
    app: { vault } as unknown as App,
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
