import { describe, expect, it } from "vitest";
import type { LibraryManifest, ShelfSection } from "../../src/core/model";
import { applyManifests, parseLibraryManifest } from "../../src/core/manifest";

describe("parseLibraryManifest", () => {
  it("parses a valid manifest", () => {
    expect(
      parseLibraryManifest(
        JSON.stringify({
          title: "AI plans",
          entries: [
            { path: "feedflow/foo.html", title: "Foo", section: "FeedFlow" },
            { path: "bar.htm", title: "Bar" },
          ],
        }),
      ),
    ).toEqual({
      ok: true,
      manifest: {
        title: "AI plans",
        entries: [
          { path: "feedflow/foo.html", title: "Foo", section: "FeedFlow" },
          { path: "bar.htm", title: "Bar" },
        ],
      },
    });
  });

  it("reports malformed JSON", () => {
    expect(parseLibraryManifest("{")).toEqual({
      ok: false,
      reason: "invalid-json",
    });
  });

  it.each([
    "null",
    "[]",
    "{}",
    '{"title":4,"entries":[]}',
    '{"entries":"nope"}',
    '{"entries":[null]}',
    '{"entries":[{"path":"a.html"}]}',
    '{"entries":[{"path":"a.html","title":3}]}',
    '{"entries":[{"path":"a.html","title":"A","section":3}]}',
  ])("reports invalid shape for %s", (raw) => {
    expect(parseLibraryManifest(raw)).toEqual({
      ok: false,
      reason: "invalid-shape",
    });
  });

  it.each([
    "/abs.html",
    "../escape.html",
    "folder/../../escape.html",
    "\\absolute.html",
  ])("rejects unsafe entry path %s", (path) => {
    expect(
      parseLibraryManifest(
        JSON.stringify({ entries: [{ path, title: "Unsafe" }] }),
      ),
    ).toEqual({ ok: false, reason: "invalid-path" });
  });
});

describe("applyManifests", () => {
  const scanned: ShelfSection[] = [
    {
      name: "feedflow",
      entries: [
        {
          path: "plans/feedflow/foo.html",
          title: "Foo scan",
          section: "feedflow",
        },
        {
          path: "plans/feedflow/unlisted.html",
          title: "Unlisted",
          section: "feedflow",
        },
      ],
    },
    {
      name: "readerflow",
      entries: [
        {
          path: "plans/readerflow/bar.html",
          title: "Bar scan",
          section: "readerflow",
        },
      ],
    },
  ];

  it("remaps listed titles and explicit sections with the library title", () => {
    const manifest: LibraryManifest = {
      title: "AI plans",
      entries: [
        {
          path: "feedflow/foo.html",
          title: "Foo curated",
          section: "FeedFlow",
        },
      ],
    };
    const result = applyManifests(scanned, [{ folder: "plans", manifest }]);
    expect(
      result.find((section) => section.name === "AI plans · FeedFlow"),
    ).toEqual({
      name: "AI plans · FeedFlow",
      entries: [
        {
          path: "plans/feedflow/foo.html",
          title: "Foo curated",
          section: "AI plans · FeedFlow",
        },
      ],
    });
  });

  it("keeps unlisted files and listed files without sections grouped together", () => {
    const manifest: LibraryManifest = {
      title: "AI plans",
      entries: [{ path: "feedflow/foo.html", title: "Foo curated" }],
    };
    const result = applyManifests(scanned, [{ folder: "plans", manifest }]);
    expect(
      result.find((section) => section.name === "feedflow")?.entries,
    ).toEqual([
      {
        path: "plans/feedflow/foo.html",
        title: "Foo curated",
        section: "feedflow",
      },
      {
        path: "plans/feedflow/unlisted.html",
        title: "Unlisted",
        section: "feedflow",
      },
    ]);
  });

  it("lets the deepest covering manifest win", () => {
    const broad: LibraryManifest = {
      entries: [
        { path: "feedflow/foo.html", title: "Broad", section: "Broad" },
      ],
    };
    const deep: LibraryManifest = {
      entries: [{ path: "foo.html", title: "Deep", section: "Deep" }],
    };
    const result = applyManifests(scanned, [
      { folder: "plans", manifest: broad },
      { folder: "plans/feedflow", manifest: deep },
    ]);
    expect(
      result.find((section) => section.name === "Deep")?.entries[0]?.title,
    ).toBe("Deep");
    expect(result.some((section) => section.name === "Broad")).toBe(false);
  });

  it("silently ignores manifest entries for files that do not exist", () => {
    const manifest: LibraryManifest = {
      entries: [{ path: "missing.html", title: "Missing", section: "Ghost" }],
    };
    expect(applyManifests(scanned, [{ folder: "plans", manifest }])).toEqual(
      scanned,
    );
  });

  it("regroups, merges, and sorts sections and entries like scanning", () => {
    const sections: ShelfSection[] = [
      {
        name: "Zulu",
        entries: [{ path: "z.html", title: "Zulu", section: "Zulu" }],
      },
      {
        name: "Middle",
        entries: [
          { path: "middle/ten.html", title: "item 10", section: "Middle" },
        ],
      },
      {
        name: "Alpha",
        entries: [{ path: "a.html", title: "Alpha", section: "Alpha" }],
      },
      {
        name: "(vault root)",
        entries: [
          { path: "root.html", title: "Root", section: "(vault root)" },
        ],
      },
    ];
    const manifest: LibraryManifest = {
      entries: [{ path: "z.html", title: "item 2", section: "Middle" }],
    };
    const result = applyManifests(sections, [{ folder: "", manifest }]);
    expect(result.map((section) => section.name)).toEqual([
      "(vault root)",
      "Alpha",
      "Middle",
    ]);
    expect(
      result
        .find((section) => section.name === "Middle")
        ?.entries.map((entry) => entry.title),
    ).toEqual(["item 2", "item 10"]);
  });
});
