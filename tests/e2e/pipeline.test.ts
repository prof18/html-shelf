import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Platform, type PluginManifest, type TFile } from "obsidian";
import HtmlShelfPlugin from "../../src/main";
import { DEFAULT_SETTINGS } from "../../src/core/model";
import { HtmlView } from "../../src/views/HtmlView";
import { ShelfIndex } from "../../src/views/ShelfIndex";
import { ShelfView } from "../../src/views/ShelfView";
import { createFakeApp, createFakeLeaf } from "../mocks/fake-app";

const manifest: PluginManifest = {
  id: "html-shelf",
  name: "HTML Shelf",
  author: "Marco Gomiero",
  version: "0.1.0",
  minAppVersion: "1.12.0",
  description: "Test manifest",
};

const fixturePaths = [
  "loose.html",
  "notes/deep/nested/delta.html",
  "plans/feedflow/alpha-plan.html",
  "plans/feedflow/beta-plan.html",
  "plans/feedflow/diagram.png",
  "plans/index.html",
  "plans/readerflow/gamma-plan.html",
];

describe("dev-vault pipeline", () => {
  it("indexes fixtures, opens a shelf row, and prepares its rendered page", async () => {
    Platform.isIosApp = false;
    Platform.isMobile = false;
    const inputs = fixturePaths.map((path) => ({
      path,
      content: readFileSync(`dev-vault/${path}`, "utf8"),
    }));
    const harness = createFakeApp(inputs);
    const index = new ShelfIndex(harness.app, () => DEFAULT_SETTINGS);

    expect(await index.build()).toEqual([
      {
        name: "(vault root)",
        entries: [
          {
            path: "loose.html",
            title: "Loose root page",
            section: "(vault root)",
          },
        ],
      },
      {
        name: "notes/deep/nested",
        entries: [
          {
            path: "notes/deep/nested/delta.html",
            title: "Delta nested note",
            section: "notes/deep/nested",
          },
        ],
      },
      {
        name: "plans/feedflow",
        entries: [
          {
            path: "plans/feedflow/alpha-plan.html",
            title: "Alpha delivery plan",
            section: "plans/feedflow",
          },
          {
            path: "plans/feedflow/beta-plan.html",
            title: "Beta navigation plan",
            section: "plans/feedflow",
          },
        ],
      },
      {
        name: "plans/readerflow",
        entries: [
          {
            path: "plans/readerflow/gamma-plan.html",
            title: "Gamma reading plan",
            section: "plans/readerflow",
          },
        ],
      },
    ]);

    const shelf = new ShelfView(
      createFakeLeaf(harness.app),
      index,
      () => DEFAULT_SETTINGS,
    );
    await shelf.onOpen();
    const alphaRow = [
      ...shelf.contentEl.querySelectorAll<HTMLButtonElement>(".hs-entry"),
    ].find((button) => button.textContent?.includes("Alpha delivery plan"));
    alphaRow?.click();
    await Promise.resolve();
    const opened = harness.leaves[0]?.openedFiles[0];
    expect(opened?.path).toBe("plans/feedflow/alpha-plan.html");

    const plugin = new HtmlShelfPlugin(harness.app, manifest);
    const htmlView = new HtmlView(createFakeLeaf(harness.app), plugin);
    await htmlView.onLoadFile(opened as unknown as TFile);
    const srcdoc =
      htmlView.contentEl.querySelector<HTMLIFrameElement>(".hs-frame")?.srcdoc;
    expect(srcdoc).toContain("Alpha delivery plan");
    expect(srcdoc).toContain("app://vault/plans/feedflow/diagram.png");
    expect(srcdoc).not.toContain("<script");
    await htmlView.onClose();
  });
});
