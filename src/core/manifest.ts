import {
  ROOT_SECTION,
  type LibraryManifest,
  type LibraryManifestEntry,
  type ShelfEntry,
  type ShelfSection,
} from "./model";

export type ManifestResult =
  | { ok: true; manifest: LibraryManifest }
  | {
      ok: false;
      reason: "invalid-json" | "invalid-shape" | "invalid-path";
    };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizePath = (path: string): string =>
  path.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\.\//, "");

const isSafeRelativePath = (path: string): boolean => {
  const normalized = normalizePath(path);
  return (
    normalized.length > 0 &&
    !normalized.startsWith("/") &&
    !/^[a-z]:\//i.test(normalized) &&
    !normalized.split("/").includes("..")
  );
};

const isManifestEntry = (value: unknown): value is LibraryManifestEntry =>
  isRecord(value) &&
  typeof value.path === "string" &&
  value.path.trim().length > 0 &&
  typeof value.title === "string" &&
  value.title.trim().length > 0 &&
  (value.section === undefined || typeof value.section === "string");

export function parseLibraryManifest(raw: string): ManifestResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { ok: false, reason: "invalid-json" };
  }

  if (
    !isRecord(parsed) ||
    !Array.isArray(parsed.entries) ||
    (parsed.title !== undefined && typeof parsed.title !== "string") ||
    !parsed.entries.every(isManifestEntry)
  ) {
    return { ok: false, reason: "invalid-shape" };
  }

  if (!parsed.entries.every((entry) => isSafeRelativePath(entry.path))) {
    return { ok: false, reason: "invalid-path" };
  }

  const entries = parsed.entries.map((entry) => ({
    path: normalizePath(entry.path),
    title: entry.title,
    ...(entry.section === undefined ? {} : { section: entry.section }),
  }));
  const manifest: LibraryManifest = {
    ...(parsed.title === undefined ? {} : { title: parsed.title }),
    entries,
  };
  return { ok: true, manifest };
}

const isWithin = (path: string, folder: string): boolean =>
  folder === "" || path === folder || path.startsWith(`${folder}/`);

const compareNames = (left: string, right: string): number =>
  left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });

const regroup = (entries: ShelfEntry[]): ShelfSection[] => {
  const bySection = new Map<string, ShelfEntry[]>();
  for (const entry of entries) {
    const grouped = bySection.get(entry.section) ?? [];
    grouped.push(entry);
    bySection.set(entry.section, grouped);
  }
  return [...bySection.entries()]
    .map(([name, grouped]) => ({
      name,
      entries: grouped.sort((left, right) =>
        compareNames(left.title, right.title),
      ),
    }))
    .sort((left, right) => {
      if (left.name === ROOT_SECTION) return -1;
      if (right.name === ROOT_SECTION) return 1;
      return compareNames(left.name, right.name);
    });
};

export function applyManifests(
  sections: ShelfSection[],
  manifests: { folder: string; manifest: LibraryManifest }[],
): ShelfSection[] {
  const normalizedManifests = manifests.map(({ folder, manifest }) => ({
    folder: normalizePath(folder).replace(/^\/|\/$/g, ""),
    manifest,
  }));
  const remapped = sections
    .flatMap((section) => section.entries)
    .map((entry) => {
      const covering = normalizedManifests
        .filter(({ folder }) => isWithin(entry.path, folder))
        .sort((left, right) => right.folder.length - left.folder.length)[0];
      if (!covering) return { ...entry };

      const relativePath = covering.folder
        ? entry.path.slice(covering.folder.length + 1)
        : entry.path;
      const manifestEntry = covering.manifest.entries.find(
        (candidate) => normalizePath(candidate.path) === relativePath,
      );
      if (!manifestEntry) return { ...entry };

      const section = manifestEntry.section
        ? covering.manifest.title
          ? `${covering.manifest.title} · ${manifestEntry.section}`
          : manifestEntry.section
        : entry.section;
      return { path: entry.path, title: manifestEntry.title, section };
    });
  return regroup(remapped);
}
