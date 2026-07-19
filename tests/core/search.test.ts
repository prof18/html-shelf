import { describe, expect, it } from "vitest";
import type { ShelfSection } from "../../src/core/model";
import { filterSections } from "../../src/core/search";

const sections: ShelfSection[] = [
  {
    name: "feedflow",
    entries: [
      {
        path: "library/feedflow/alpha.html",
        title: "Alpha plan",
        section: "feedflow",
      },
      {
        path: "library/feedflow/beta.html",
        title: "Beta notes",
        section: "feedflow",
      },
    ],
  },
  {
    name: "readerflow",
    entries: [
      {
        path: "library/readerflow/gamma.html",
        title: "Gamma plan",
        section: "readerflow",
      },
    ],
  },
];

describe("filterSections", () => {
  it.each(["", "  \n "])(
    "returns the input unchanged for empty query %j",
    (query) => {
      expect(filterSections(sections, query)).toBe(sections);
    },
  );

  it("matches case-insensitive substrings across title, path, and section", () => {
    expect(filterSections(sections, "ALPHA")[0]?.entries[0]?.title).toBe(
      "Alpha plan",
    );
    expect(filterSections(sections, "readerflow")[0]?.entries[0]?.title).toBe(
      "Gamma plan",
    );
    expect(filterSections(sections, "beta.html")[0]?.entries[0]?.title).toBe(
      "Beta notes",
    );
  });

  it("ANDs terms even when they match different fields", () => {
    expect(filterSections(sections, "feed plan")).toEqual([
      {
        name: "feedflow",
        entries: [
          {
            path: "library/feedflow/alpha.html",
            title: "Alpha plan",
            section: "feedflow",
          },
        ],
      },
    ]);
  });

  it("drops sections without surviving entries", () => {
    expect(
      filterSections(sections, "gamma").map((section) => section.name),
    ).toEqual(["readerflow"]);
    expect(filterSections(sections, "missing")).toEqual([]);
  });
});
