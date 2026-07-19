import { describe, expect, it } from "vitest";
import { normalizePath } from "obsidian";
import { normalizePath as mockNormalizePath } from "./mocks/obsidian";

describe("test harness", () => {
  it("resolves obsidian imports to the local mock", () => {
    expect(normalizePath).toBe(mockNormalizePath);
  });

  it("normalizes vault paths", () => {
    expect(normalizePath("a\\b//c/")).toBe("a/b/c");
  });
});
