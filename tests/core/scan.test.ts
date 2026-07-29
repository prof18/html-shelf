import { describe, expect, it } from "vitest";
import type { ShelfSettings } from "../../src/core/model";
import {
  buildSections,
  isHtmlPath,
  isIndexFile,
  isInScope,
} from "../../src/core/scan";

const settings = (overrides: Partial<ShelfSettings> = {}): ShelfSettings => ({
  includeFolders: [],
  excludeFolders: [],
  includeHtm: true,
  ...overrides,
});

describe("isHtmlPath", () => {
  it.each(["page.html", "PAGE.HTML", "folder/a.HtMl"])(
    "accepts HTML path %s",
    (path) => expect(isHtmlPath(path, false)).toBe(true),
  );

  it("accepts .htm only when enabled", () => {
    expect(isHtmlPath("page.htm", true)).toBe(true);
    expect(isHtmlPath("page.HTM", true)).toBe(true);
    expect(isHtmlPath("page.htm", false)).toBe(false);
  });

  it.each(["page.xhtml", "page.md", "foo.html.md", "html"])(
    "rejects non-page path %s",
    (path) => expect(isHtmlPath(path, true)).toBe(false),
  );
});

describe("isIndexFile", () => {
  it.each(["plans/index.html", "INDEX.HTM", "deep/Index.HtMl"])(
    "detects index file %s",
    (path) => expect(isIndexFile(path)).toBe(true),
  );

  it.each(["my-index.html", "index-of-things.html", "index.md"])(
    "does not misclassify %s",
    (path) => expect(isIndexFile(path)).toBe(false),
  );
});

describe("isInScope", () => {
  it("includes the whole vault when includes are empty", () => {
    expect(isInScope("any/depth/page.html", settings())).toBe(true);
  });

  it("matches include roots at segment boundaries", () => {
    const scoped = settings({ includeFolders: ["/plans//"] });
    expect(isInScope("plans/a.html", scoped)).toBe(true);
    expect(isInScope("plans\\x\\b.html", scoped)).toBe(true);
    expect(isInScope("plans-old/c.html", scoped)).toBe(false);
  });

  it("lets excludes win using the same segment boundaries", () => {
    const scoped = settings({
      includeFolders: ["plans"],
      excludeFolders: ["plans/archive"],
    });
    expect(isInScope("plans/archive/a.html", scoped)).toBe(false);
    expect(isInScope("plans/archive/deep/a.html", scoped)).toBe(false);
    expect(isInScope("plans/archive-old/a.html", scoped)).toBe(true);
  });
});

describe("buildSections", () => {
  const titleFor = (path: string): string =>
    ({
      "plans/alpha.html": "Alpha 10",
      "plans/beta.html": "alpha 2",
      "root.html": "Root",
    })[path] ?? "Untitled";

  it("filters scope, extensions, and index pages", () => {
    expect(
      buildSections(
        [
          { path: "plans/alpha.html" },
          { path: "plans/legacy.htm" },
          { path: "plans/index.html" },
          { path: "outside/page.html" },
          { path: "plans/note.md" },
        ],
        settings({ includeFolders: ["plans"], includeHtm: false }),
        titleFor,
      ),
    ).toEqual([
      {
        name: "plans",
        entries: [
          { path: "plans/alpha.html", title: "Alpha 10", section: "plans" },
        ],
      },
    ]);
  });

  it("uses full parent paths in whole-vault mode and puts root first", () => {
    expect(
      buildSections(
        [{ path: "z/a.html" }, { path: "root.html" }, { path: "a/b.html" }],
        settings(),
        (path) => path,
      ).map((section) => section.name),
    ).toEqual(["(vault root)", "a", "z"]);
  });

  it("uses the deepest overlapping include root", () => {
    expect(
      buildSections(
        [{ path: "plans/feedflow/deep/a.html" }],
        settings({ includeFolders: ["plans", "plans/feedflow"] }),
        () => "Alpha",
      )[0]?.name,
    ).toBe("deep");
  });

  it("names files directly in an include root after its last segment", () => {
    expect(
      buildSections(
        [{ path: "projects/plans/a.html" }],
        settings({ includeFolders: ["projects/plans"] }),
        () => "Alpha",
      )[0]?.name,
    ).toBe("plans");
  });

  it("merges sections with the same relative name across include roots", () => {
    const result = buildSections(
      [{ path: "plans/guides/x.html" }, { path: "docs/guides/y.html" }],
      settings({ includeFolders: ["plans", "docs"] }),
      (path) => path,
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("guides");
    expect(result[0]?.entries).toHaveLength(2);
  });

  it("sorts entries by title case-insensitively and numeric-aware", () => {
    const result = buildSections(
      [{ path: "plans/alpha.html" }, { path: "plans/beta.html" }],
      settings(),
      titleFor,
    );
    expect(result[0]?.entries.map((entry) => entry.title)).toEqual([
      "alpha 2",
      "Alpha 10",
    ]);
  });

  it("uses a humanized basename if titleFor has no answer", () => {
    const emptyTitles: Record<string, string> = {};
    const result = buildSections(
      [{ path: "plans/my-sample_page.html" }],
      settings(),
      (path) => emptyTitles[path] ?? "",
    );
    expect(result[0]?.entries[0]?.title).toBe("My sample page");
  });

  it("falls back to the path when an HTML basename has no words", () => {
    const result = buildSections([{ path: ".html" }], settings(), () => "");
    expect(result[0]?.entries[0]?.title).toBe(".html");
  });

  it("returns an empty array for empty input", () => {
    expect(buildSections([], settings(), titleFor)).toEqual([]);
  });
});
