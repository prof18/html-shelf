import { Notice, type App, type TFile } from "obsidian";
import { applyManifests, parseLibraryManifest } from "../core/manifest";
import type {
  LibraryManifest,
  ShelfSection,
  ShelfSettings,
} from "../core/model";
import { mapWithConcurrency } from "../core/pool";
import {
  buildSections,
  isHtmlPath,
  isIndexFile,
  isInScope,
} from "../core/scan";
import { deriveTitle, extractTitleTag } from "../core/titles";

interface ManifestAtFolder {
  folder: string;
  manifest: LibraryManifest;
}

const basename = (path: string): string => {
  const name = path.slice(path.lastIndexOf("/") + 1);
  return name.replace(/\.html?$/i, "");
};

const folderOf = (path: string): string =>
  path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";

const isWithin = (path: string, folder: string): boolean =>
  folder === "" || path.startsWith(`${folder}/`);

const isManifestListed = (
  path: string,
  manifests: ManifestAtFolder[],
): boolean => {
  const covering = manifests
    .filter(({ folder }) => isWithin(path, folder))
    .sort((left, right) => right.folder.length - left.folder.length)[0];
  if (!covering) return false;
  const relativePath = covering.folder
    ? path.slice(covering.folder.length + 1)
    : path;
  return covering.manifest.entries.some((entry) => entry.path === relativePath);
};

export class ShelfIndex {
  private readonly titleCache = new Map<
    string,
    { mtime: number; title: string }
  >();
  private readonly shownManifestErrors = new Set<string>();

  constructor(
    private app: App,
    private getSettings: () => ShelfSettings,
  ) {}

  async build(): Promise<ShelfSection[]> {
    const files = this.app.vault.getFiles();
    const settings = this.getSettings();
    const manifests: ManifestAtFolder[] = [];

    for (const file of files.filter(
      ({ path }) => path.slice(path.lastIndexOf("/") + 1) === "html-shelf.json",
    )) {
      const result = parseLibraryManifest(
        await this.app.vault.cachedRead(file),
      );
      if (result.ok) {
        manifests.push({
          folder: folderOf(file.path),
          manifest: result.manifest,
        });
      } else {
        const key = `${file.path}:${result.reason}`;
        if (!this.shownManifestErrors.has(key)) {
          this.shownManifestErrors.add(key);
          new Notice(
            `Invalid HTML shelf manifest: ${file.path} (${result.reason})`,
          );
        }
      }
    }

    const titleFiles = files.filter(
      (file) =>
        isHtmlPath(file.path, settings.includeHtm) &&
        !isIndexFile(file.path) &&
        isInScope(file.path, settings) &&
        !isManifestListed(file.path, manifests),
    );
    const titles = new Map<string, string>();
    const uncached: TFile[] = [];
    for (const file of titleFiles) {
      const cached = this.titleCache.get(file.path);
      if (cached?.mtime === file.stat.mtime) {
        titles.set(file.path, cached.title);
      } else {
        uncached.push(file);
      }
    }

    const loaded = await mapWithConcurrency(uncached, 8, async (file) => {
      const html = await this.app.vault.cachedRead(file);
      const title =
        extractTitleTag(html.slice(0, 8_192)) ??
        deriveTitle(html, basename(file.path));
      return { file, title };
    });
    for (const { file, title } of loaded) {
      titles.set(file.path, title);
      this.titleCache.set(file.path, { mtime: file.stat.mtime, title });
    }

    const sections = buildSections(
      files,
      settings,
      (path) => titles.get(path) ?? deriveTitle("", basename(path)),
    );
    return applyManifests(sections, manifests);
  }

  invalidate(path?: string): void {
    if (path === undefined) this.titleCache.clear();
    else this.titleCache.delete(path);
  }
}
