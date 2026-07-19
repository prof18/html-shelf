import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, ROOT_SECTION } from "../../src/core/model";

describe("core model", () => {
  it("pins the public default settings", () => {
    expect(DEFAULT_SETTINGS).toEqual({
      includeFolders: [],
      excludeFolders: [],
      includeHtm: true,
    });
  });

  it("pins the vault-root section label", () => {
    expect(ROOT_SECTION).toBe("(vault root)");
  });
});
