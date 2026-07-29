import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, type ShelfSettings } from "../../src/core/model";
import { ShelfIndex } from "../../src/views/ShelfIndex";
import { createFakeApp } from "../mocks/fake-app";
import { noticeMessages } from "../mocks/obsidian";

describe("ShelfIndex", () => {
  beforeEach(() => noticeMessages.splice(0));

  it("builds scoped sections and applies a manifest discovered above the include root", async () => {
    const harness = createFakeApp([
      {
        path: "plans/html-shelf.json",
        content: JSON.stringify({
          title: "Plans",
          entries: [
            {
              path: "feedflow/alpha.html",
              title: "Curated alpha",
              section: "FeedFlow",
            },
          ],
        }),
      },
      {
        path: "plans/feedflow/alpha.html",
        content: "<title>Ignored title</title>",
      },
      {
        path: "plans/feedflow/beta.html",
        content: "<title>Beta title</title>",
      },
      { path: "plans/feedflow/index.html", content: "<title>Hidden</title>" },
      {
        path: "plans/readerflow/gamma.html",
        content: "<title>Out of scope</title>",
      },
      { path: "notes/readme.md", content: "Markdown" },
    ]);
    const settings: ShelfSettings = {
      ...DEFAULT_SETTINGS,
      includeFolders: ["plans/feedflow"],
    };
    const index = new ShelfIndex(harness.app, () => settings);

    expect(await index.build()).toEqual([
      {
        name: "feedflow",
        entries: [
          {
            path: "plans/feedflow/beta.html",
            title: "Beta title",
            section: "feedflow",
          },
        ],
      },
      {
        name: "Plans · FeedFlow",
        entries: [
          {
            path: "plans/feedflow/alpha.html",
            title: "Curated alpha",
            section: "Plans · FeedFlow",
          },
        ],
      },
    ]);
    expect(harness.readCount("plans/feedflow/alpha.html")).toBe(0);
    expect(harness.readCount("plans/readerflow/gamma.html")).toBe(0);
  });

  it("applies a valid root manifest to a root-level page", async () => {
    const harness = createFakeApp([
      {
        path: "html-shelf.json",
        content: JSON.stringify({
          entries: [{ path: "page.html", title: "Curated root" }],
        }),
      },
      { path: "page.html", content: "<title>Ignored</title>" },
    ]);
    const index = new ShelfIndex(harness.app, () => DEFAULT_SETTINGS);

    expect((await index.build())[0]?.entries[0]?.title).toBe("Curated root");
    expect(harness.readCount("page.html")).toBe(0);
  });

  it("caches titles by path and mtime", async () => {
    const harness = createFakeApp([
      { path: "page.html", content: "<title>First title</title>", mtime: 1 },
    ]);
    const index = new ShelfIndex(harness.app, () => DEFAULT_SETTINGS);
    expect((await index.build())[0]?.entries[0]?.title).toBe("First title");
    expect((await index.build())[0]?.entries[0]?.title).toBe("First title");
    expect(harness.readCount("page.html")).toBe(1);

    harness.setContent("page.html", "<title>Second title</title>");
    harness.setMtime("page.html", 2);
    expect((await index.build())[0]?.entries[0]?.title).toBe("Second title");
    expect(harness.readCount("page.html")).toBe(2);
  });

  it("supports targeted and full cache invalidation", async () => {
    const harness = createFakeApp([
      { path: "a.html", content: "<title>A</title>" },
      { path: "b.html", content: "<title>B</title>" },
    ]);
    const index = new ShelfIndex(harness.app, () => DEFAULT_SETTINGS);
    await index.build();
    index.invalidate("a.html");
    await index.build();
    expect(harness.readCount("a.html")).toBe(2);
    expect(harness.readCount("b.html")).toBe(1);
    index.invalidate();
    await index.build();
    expect(harness.readCount("a.html")).toBe(3);
    expect(harness.readCount("b.html")).toBe(2);
  });

  it("falls through to a full parse when the 8 KB prefix cuts the title", async () => {
    const padding = " ".repeat(8_180);
    const harness = createFakeApp([
      {
        path: "large.html",
        content: `${padding}<title>Boundary title</title>`,
      },
    ]);
    const index = new ShelfIndex(harness.app, () => DEFAULT_SETTINGS);
    expect((await index.build())[0]?.entries[0]?.title).toBe("Boundary title");
  });

  it("shows each invalid manifest reason only once per session", async () => {
    const harness = createFakeApp([
      { path: "html-shelf.json", content: "{" },
      { path: "page.html", content: "<title>Page</title>" },
    ]);
    const index = new ShelfIndex(harness.app, () => DEFAULT_SETTINGS);
    await index.build();
    await index.build();
    expect(noticeMessages).toEqual([
      "Invalid HTML shelf manifest: html-shelf.json (invalid-json)",
    ]);
  });
});
