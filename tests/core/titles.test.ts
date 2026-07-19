import { describe, expect, it } from "vitest";
import { deriveTitle } from "../../src/core/titles";

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
