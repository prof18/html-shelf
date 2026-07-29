import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pluginStyles = readFileSync("styles.css", "utf8");

describe("shelf styles", () => {
  it("lets two-line entry buttons grow beyond Obsidian's control height", () => {
    document.head.innerHTML = `
      <style>button { height: 32px; }</style>
      <style>${pluginStyles}</style>
    `;
    document.body.innerHTML = `
      <div class="hs-shelf">
        <button class="hs-entry">
          <span class="hs-entry-title">Page title</span>
          <span class="hs-entry-path">folder/page.html</span>
        </button>
      </div>
    `;

    const entry = document.querySelector<HTMLButtonElement>(".hs-entry");
    expect(entry).not.toBeNull();

    const styles = getComputedStyle(entry!);
    expect(styles.height).toBe("auto");
    expect(styles.paddingBottom).toBe("10px");
  });

  it("keeps the final shelf entry above mobile floating navigation", () => {
    document.head.innerHTML = `<style>${pluginStyles}</style>`;
    document.body.className = "is-mobile";
    document.body.innerHTML = `<div class="hs-sections"></div>`;

    const sections = getComputedStyle(
      document.querySelector<HTMLElement>(".hs-sections")!,
    );

    expect(sections.paddingBottom).toBe("112px");
  });

  it("gives the HTML iframe full control of page scrolling", () => {
    document.head.innerHTML = `<style>${pluginStyles}</style>`;
    document.body.innerHTML = `
      <div class="workspace-leaf-content" data-type="html-shelf-page">
        <div class="view-content"><iframe class="hs-frame"></iframe></div>
      </div>
    `;

    const content = document.querySelector<HTMLElement>(".view-content")!;
    const frame = document.querySelector<HTMLIFrameElement>(".hs-frame")!;
    const contentStyles = getComputedStyle(content);
    const frameStyles = getComputedStyle(frame);

    expect(contentStyles.overflow).toBe("hidden");
    expect(contentStyles.padding).toBe("0px");
    expect(frameStyles.width).toBe("100%");
    expect(frameStyles.height).toBe("100%");
    expect(frameStyles.borderTopWidth).toBe("0px");
  });

  it("positions the page controls as compact floating chrome", () => {
    document.head.innerHTML = `<style>${pluginStyles}</style>`;
    document.body.innerHTML = `
      <div class="workspace-leaf-content" data-type="html-shelf-page">
        <div class="view-content"><div class="hs-pagebar"></div></div>
      </div>
    `;

    const content = getComputedStyle(
      document.querySelector<HTMLElement>(".view-content")!,
    );
    const pagebar = getComputedStyle(
      document.querySelector<HTMLElement>(".hs-pagebar")!,
    );

    expect(content.position).toBe("relative");
    expect(pagebar.position).toBe("absolute");
    expect(pagebar.zIndex).not.toBe("auto");
    expect(Number(pagebar.opacity)).toBeLessThanOrEqual(0.85);
  });
});
