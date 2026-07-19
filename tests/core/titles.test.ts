import { describe, expect, it } from "vitest";
import { deriveTitle, extractTitleTag } from "../../src/core/titles";

describe("deriveTitle", () => {
  it("prefers the first title and normalizes its text", () => {
    expect(
      deriveTitle(
        "<title>  Alpha &amp;\n beta  </title><h1>Ignored</h1>",
        "fallback",
      ),
    ).toBe("Alpha & beta");
  });

  it("falls back to the first non-empty h1", () => {
    expect(
      deriveTitle("<title> </title><h1>  Main <em>heading</em> </h1>", "file"),
    ).toBe("Main heading");
  });

  it("humanizes a basename using sentence case", () => {
    expect(
      deriveTitle(
        "<p>No heading</p>",
        "youtube-playlists_and-hide-shorts-plan",
      ),
    ).toBe("Youtube playlists and hide shorts plan");
  });

  it("caps titles at 120 characters with an ellipsis", () => {
    const result = deriveTitle(`<title>${"x".repeat(140)}</title>`, "file");
    expect(result).toHaveLength(120);
    expect(result).toBe(`${"x".repeat(119)}…`);
  });

  it("does not throw for malformed garbage", () => {
    expect(() =>
      deriveTitle("<title><<<<<\u0000", "broken-file"),
    ).not.toThrow();
    expect(deriveTitle("<title><<<<<\u0000", "broken-file")).not.toBe("");
  });

  it("returns a stable fallback for an empty basename", () => {
    expect(deriveTitle("", "")).toBe("Untitled");
  });
});

describe("extractTitleTag", () => {
  it("extracts and normalizes a complete title from a prefix", () => {
    expect(extractTitleTag("<title> Alpha &amp;  beta </title><p>rest")).toBe(
      "Alpha & beta",
    );
  });

  it("returns null without a complete closing title tag", () => {
    const page = `<title>${"x".repeat(9_000)}</title>`;
    expect(extractTitleTag(page.slice(0, 8_192))).toBeNull();
  });

  it("returns null when a complete prefix has no usable title", () => {
    expect(extractTitleTag("<title> </title><h1>Heading</h1>")).toBeNull();
    expect(extractTitleTag("<h1>Heading</h1>")).toBeNull();
  });

  it("applies the display-title length cap", () => {
    expect(extractTitleTag(`<title>${"x".repeat(140)}</title>`)).toBe(
      `${"x".repeat(119)}…`,
    );
  });
});
