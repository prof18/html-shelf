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
});
