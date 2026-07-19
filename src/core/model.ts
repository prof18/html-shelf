export interface ShelfSettings {
  includeFolders: string[];
  excludeFolders: string[];
  includeHtm: boolean;
}

export const DEFAULT_SETTINGS: ShelfSettings = {
  includeFolders: [],
  excludeFolders: [],
  includeHtm: true,
};

export const ROOT_SECTION = "(vault root)";

export interface ShelfEntry {
  path: string;
  title: string;
  section: string;
}

export interface ShelfSection {
  name: string;
  entries: ShelfEntry[];
}

export interface LibraryManifest {
  title?: string;
  entries: LibraryManifestEntry[];
}

export interface LibraryManifestEntry {
  path: string;
  title: string;
  section?: string;
}
