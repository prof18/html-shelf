import { ROOT_SECTION, type ShelfSection, type ShelfSettings } from "./model";

export interface ScannedFile {
  path: string;
}

const normalizeVaultPath = (path: string): string =>
  path
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/^\/|\/$/g, "");

const isWithin = (path: string, folder: string): boolean =>
  path === folder || path.startsWith(`${folder}/`);

const compareNames = (left: string, right: string): number =>
  left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });

const basenameTitle = (path: string): string => {
  const segments = path.split("/");
  const basename = segments[segments.length - 1]!.replace(/\.html?$/i, "");
  const words = basename.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  return words ? words[0]!.toUpperCase() + words.slice(1) : path;
};

const normalizedFolders = (folders: string[]): string[] =>
  folders.map(normalizeVaultPath).filter(Boolean);

export function isHtmlPath(path: string, includeHtm: boolean): boolean {
  const lower = path.toLowerCase();
  return lower.endsWith(".html") || (includeHtm && lower.endsWith(".htm"));
}

export function isIndexFile(path: string): boolean {
  const segments = normalizeVaultPath(path).split("/");
  return /^index\.html?$/i.test(segments[segments.length - 1]!);
}

export function isInScope(path: string, settings: ShelfSettings): boolean {
  const normalized = normalizeVaultPath(path);
  const includes = normalizedFolders(settings.includeFolders);
  const excludes = normalizedFolders(settings.excludeFolders);
  const included =
    includes.length === 0 ||
    includes.some((folder) => isWithin(normalized, folder));
  return included && !excludes.some((folder) => isWithin(normalized, folder));
}

export function buildSections(
  files: ScannedFile[],
  settings: ShelfSettings,
  titleFor: (path: string) => string,
): ShelfSection[] {
  const includeRoots = normalizedFolders(settings.includeFolders);
  const entriesBySection = new Map<string, ShelfSection["entries"]>();

  for (const file of files) {
    const path = normalizeVaultPath(file.path);
    if (
      !isHtmlPath(path, settings.includeHtm) ||
      isIndexFile(path) ||
      !isInScope(path, settings)
    ) {
      continue;
    }

    const parent = path.includes("/")
      ? path.slice(0, path.lastIndexOf("/"))
      : "";
    const matchingRoot = includeRoots
      .filter((root) => isWithin(path, root))
      .sort((left, right) => right.length - left.length)[0];
    let section: string;

    if (!matchingRoot) {
      section = parent || ROOT_SECTION;
    } else {
      const relativePath = path.slice(matchingRoot.length).replace(/^\//, "");
      const relativeParent = relativePath.includes("/")
        ? relativePath.slice(0, relativePath.lastIndexOf("/"))
        : "";
      const rootSegments = matchingRoot.split("/");
      section = relativeParent || rootSegments[rootSegments.length - 1]!;
    }

    const title = titleFor(path).trim() || basenameTitle(path);
    const entries = entriesBySection.get(section) ?? [];
    entries.push({ path, title, section });
    entriesBySection.set(section, entries);
  }

  return [...entriesBySection.entries()]
    .map(([name, entries]) => ({
      name,
      entries: entries.sort((left, right) =>
        compareNames(left.title, right.title),
      ),
    }))
    .sort((left, right) => {
      if (left.name === ROOT_SECTION) return -1;
      if (right.name === ROOT_SECTION) return 1;
      return compareNames(left.name, right.name);
    });
}
