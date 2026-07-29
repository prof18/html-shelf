import { describe, expect, it } from "vitest";
import {
  collectRelativeImagePaths,
  imageDataUrl,
  loadInlineImageUrls,
  resolveRelativeResourcePath,
} from "../../src/core/assets";

describe("relative page assets", () => {
  it("resolves vault-local resources and rejects unsafe or remote values", () => {
    expect(
      resolveRelativeResourcePath("images/diagram.png", "plans/page.html"),
    ).toBe("plans/images/diagram.png");
    expect(
      resolveRelativeResourcePath("https://example.com/a.png", "page.html"),
    ).toBeNull();
    expect(
      resolveRelativeResourcePath("../../../a.png", "page.html"),
    ).toBeNull();
    expect(resolveRelativeResourcePath("#icon", "page.html")).toBeNull();
    expect(resolveRelativeResourcePath("", "page.html")).toBeNull();
    expect(resolveRelativeResourcePath("/root.png", "page.html")).toBeNull();
    expect(
      resolveRelativeResourcePath("//cdn.test/a.png", "page.html"),
    ).toBeNull();
  });

  it("collects unique relative image paths from HTML", () => {
    expect(
      collectRelativeImagePaths(
        `<img src="diagram.png"><img src="diagram.png">
         <input type="image" src="buttons/go.png">
         <input type="text" src="ignored.png"><input src="ignored-too.png">
         <img src="https://example.com/remote.png"><img src="../../../escape.png">`,
        "plans/feedflow/alpha.html",
      ),
    ).toEqual(["plans/feedflow/diagram.png", "plans/feedflow/buttons/go.png"]);
  });

  it("encodes supported images and enforces the byte cap", () => {
    const bytes = Uint8Array.from([0, 1, 2, 255]).buffer;
    expect(imageDataUrl("diagram.png", bytes)).toBe(
      "data:image/png;base64,AAEC/w==",
    );
    expect(imageDataUrl("photo.JPG", bytes)).toContain(
      "data:image/jpeg;base64,",
    );
    expect(imageDataUrl("diagram.png", bytes, 3)).toBeNull();
    expect(imageDataUrl("payload.bin", bytes)).toBeNull();
    const multiChunk = new Uint8Array(32_769);
    expect(imageDataUrl("large.webp", multiChunk.buffer)).toContain(
      "data:image/webp;base64,",
    );
  });

  it("loads available local images and skips unreadable ones", async () => {
    const urls = await loadInlineImageUrls(
      '<img src="diagram.png"><img src="missing.jpg">',
      "plans/page.html",
      async (path) =>
        path.endsWith("diagram.png")
          ? Uint8Array.from([0, 1, 2, 255]).buffer
          : Promise.reject(new Error("missing")),
    );

    expect([...urls]).toEqual([
      ["plans/diagram.png", "data:image/png;base64,AAEC/w=="],
    ]);
  });

  it("skips null data and unsupported local image formats", async () => {
    const urls = await loadInlineImageUrls(
      '<img src="empty.png"><img src="unsupported.tiff">',
      "plans/page.html",
      (path) =>
        Promise.resolve(
          path.endsWith("empty.png") ? null : Uint8Array.from([1]).buffer,
        ),
    );

    expect(urls.size).toBe(0);
  });
});
