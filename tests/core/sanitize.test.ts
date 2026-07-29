import { describe, expect, it, vi } from "vitest";
import { prepareHtml, type SanitizeContext } from "../../src/core/sanitize";
import realPlan from "../fixtures/real-plan.html?raw";

const context = (
  overrides: Partial<SanitizeContext> = {},
): SanitizeContext => ({
  filePath: "plans/feedflow/alpha.html",
  mobile: false,
  resourceUrl: (path) => `vault://${path}`,
  theme: "dark",
  ...overrides,
});

const parse = (html: string): Document =>
  new DOMParser().parseFromString(html, "text/html");

describe("prepareHtml execution stripping", () => {
  it("removes executable and embedding elements plus refresh and base", () => {
    const output = prepareHtml(
      `<base href="https://evil.test/"><meta http-equiv="REFRESH" content="0;url=x">
       <script>alert(1)</script><object></object><embed><applet></applet><iframe></iframe>
       <p>Safe</p>`,
      context(),
    );
    const document = parse(output);
    expect(
      document.querySelector("script,object,embed,applet,iframe,base"),
    ).toBeNull();
    expect(document.querySelector('meta[http-equiv="REFRESH"]')).toBeNull();
    expect(document.querySelector("p")?.textContent).toBe("Safe");
  });

  it("strips handlers, javascript URLs, and forged routing data across namespaces", () => {
    const document = parse(
      prepareHtml(
        `<div onclick="x()" data-hs-link="forged"></div>
         <svg onload="x()"><a href="JavaScript:alert(1)">bad</a><circle data-hs-owned="x" /></svg>
         <math><mrow onmouseover="x()"></mrow></math>
         <img src="jav&#9;ascript:alert(1)">
         <a data-hs-link='{"kind":"page"}'>planted</a>`,
        context(),
      ),
    );
    expect(
      document.querySelector("[onclick],[onload],[onmouseover]"),
    ).toBeNull();
    expect(document.querySelector("[data-hs-owned]")).toBeNull();
    expect(document.querySelector("img")?.hasAttribute("src")).toBe(false);
    expect(
      document.querySelector("a:last-of-type")?.hasAttribute("data-hs-link"),
    ).toBe(false);
  });

  it("neutralizes forms, ping, and external SVG use targets", () => {
    const document = parse(
      prepareHtml(
        `<form action="https://evil.test"><button formaction="https://evil.test">Go</button></form>
         <a href="next.html" ping="https://tracker.test">Next</a>
         <svg xmlns:xlink="http://www.w3.org/1999/xlink">
           <use id="remote" xlink:href="https://evil.test/icons.svg#x" />
           <use id="local" href="#check" />
         </svg>`,
        context(),
      ),
    );
    expect(document.querySelector("form")?.getAttribute("action")).toBe("#");
    expect(document.querySelector("button")?.hasAttribute("formaction")).toBe(
      false,
    );
    expect(document.querySelector("a")?.hasAttribute("ping")).toBe(false);
    expect(document.querySelector("#remote")).toBeNull();
    expect(document.querySelector("#local")?.getAttribute("href")).toBe(
      "#check",
    );
  });
});

describe("prepareHtml CSS policy", () => {
  it("removes remote and prefetch links but rewrites relative stylesheets", () => {
    const resourceUrl = vi.fn((path: string) => `vault://${path}`);
    const document = parse(
      prepareHtml(
        `<link rel="stylesheet" href="https://evil.test/a.css">
         <link rel="preload" href="preload.css">
         <link rel="icon" href="icon.png">
         <link rel="stylesheet" href="styles/page.css">`,
        context({ resourceUrl }),
      ),
    );
    const links = [...document.querySelectorAll("link")];
    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute("href")).toBe(
      "vault://plans/feedflow/styles/page.css",
    );
    expect(resourceUrl).toHaveBeenCalledWith("plans/feedflow/styles/page.css");
  });

  it("strips all import forms while preserving surrounding CSS", () => {
    const css = `a{color:red}\n@import "a.css";\n@IMPORT url(https://x.test/b.css) screen;\nb{color:blue}`;
    const document = parse(prepareHtml(`<style>${css}</style>`, context()));
    const result = document.querySelector("style")?.textContent ?? "";
    expect(result).not.toMatch(/@import/i);
    expect(result).toContain("a{color:red}\n");
    expect(result).toContain("\nb{color:blue}");
  });

  it("leaves import-free inline style text byte-identical", () => {
    const css = "\n:root { --ink: #222; }\nbody { color: var(--ink); }\n";
    const document = parse(
      prepareHtml(`<style id="page-css">${css}</style>`, context()),
    );
    expect(document.querySelector("#page-css")?.textContent).toBe(css);
  });
});

describe("prepareHtml asset rewriting", () => {
  it("rewrites every supported relative asset sink", () => {
    const resourceUrl = vi.fn((path: string) => `vault://${path}`);
    const document = parse(
      prepareHtml(
        `<img src="image.png"><source src="media/source.mp4"><video src="movie.mp4" poster="poster.jpg"></video>
         <audio src="sound.mp3"></audio><track src="captions.vtt"><input type="image" src="button.png">`,
        context({ resourceUrl }),
      ),
    );
    expect(document.querySelector("img")?.getAttribute("src")).toBe(
      "vault://plans/feedflow/image.png",
    );
    expect(document.querySelector("source")?.getAttribute("src")).toBe(
      "vault://plans/feedflow/media/source.mp4",
    );
    expect(document.querySelector("video")?.getAttribute("src")).toBe(
      "vault://plans/feedflow/movie.mp4",
    );
    expect(document.querySelector("video")?.getAttribute("poster")).toBe(
      "vault://plans/feedflow/poster.jpg",
    );
    expect(document.querySelector("audio")?.getAttribute("src")).toBe(
      "vault://plans/feedflow/sound.mp3",
    );
    expect(document.querySelector("track")?.getAttribute("src")).toBe(
      "vault://plans/feedflow/captions.vtt",
    );
    expect(document.querySelector("input")?.getAttribute("src")).toBe(
      "vault://plans/feedflow/button.png",
    );
  });

  it("strips srcset, preserves remote media, and leaves unresolvable relatives", () => {
    const document = parse(
      prepareHtml(
        `<img src="https://images.test/a.png" srcset="a.png 1x, b.png 2x">
         <video src="http://media.test/a.mp4"></video><img id="escape" src="../../../escape.png">`,
        context(),
      ),
    );
    expect(document.querySelector("[srcset]")).toBeNull();
    expect(document.querySelector("img")?.getAttribute("src")).toBe(
      "https://images.test/a.png",
    );
    expect(document.querySelector("video")?.getAttribute("src")).toBe(
      "http://media.test/a.mp4",
    );
    expect(document.querySelector("#escape")?.getAttribute("src")).toBe(
      "../../../escape.png",
    );
  });
});

describe("prepareHtml link tagging and theme", () => {
  it("tags and neutralizes HTML anchors, image-map areas, and SVG anchors", () => {
    const document = parse(
      prepareHtml(
        `<a id="page" href="next.html" target="_blank">Next</a>
         <area id="area" href="#spot" target="map">
         <svg xmlns:xlink="http://www.w3.org/1999/xlink"><a id="svg" xlink:href="https://example.com">SVG</a></svg>`,
        context(),
      ),
    );
    const page = document.querySelector("#page");
    expect(page?.getAttribute("href")).toBe("#");
    expect(JSON.parse(page?.getAttribute("data-hs-link") ?? "null")).toEqual({
      kind: "page",
      path: "plans/feedflow/next.html",
    });
    expect(page?.hasAttribute("target")).toBe(false);
    expect(document.querySelector("#area")?.getAttribute("href")).toBe("#");
    expect(document.querySelector("#area")?.hasAttribute("data-hs-link")).toBe(
      true,
    );
    expect(document.querySelector("#svg")?.getAttribute("href")).toBe("#");
    expect(document.querySelector("#svg")?.hasAttribute("xlink:href")).toBe(
      false,
    );
  });

  it("removes unrecognized navigable attributes", () => {
    const document = parse(
      prepareHtml(
        `<div href="https://evil.test" xlink:href="x"></div>`,
        context(),
      ),
    );
    expect(document.querySelector("div")?.hasAttribute("href")).toBe(false);
    expect(document.querySelector("div")?.hasAttribute("xlink:href")).toBe(
      false,
    );
  });

  it.each(["light", "dark"] as const)(
    "sets the %s theme hint and serializes a doctype",
    (theme) => {
      const output = prepareHtml("<p>Hello</p>", context({ theme }));
      const document = parse(output);
      expect(output.startsWith("<!DOCTYPE html>")).toBe(true);
      expect(document.documentElement.dataset.hsTheme).toBe(theme);
      const styles = [...document.querySelectorAll("style")];
      expect(styles[styles.length - 1]?.textContent).toContain(
        `:root[data-hs-theme="${theme}"]`,
      );
    },
  );

  it("adds scrollable bottom clearance inside mobile pages", () => {
    const document = parse(
      prepareHtml("<main>Page</main>", context({ mobile: true })),
    );

    expect(document.documentElement.dataset.hsMobile).toBe("true");
    expect(document.head.lastElementChild?.textContent).toContain(
      "body::after",
    );
    expect(document.head.lastElementChild?.textContent).toContain("176px");
  });
});

describe("prepareHtml realistic fixture", () => {
  it("produces a safe, reparsable page without losing its inline design", () => {
    const output = prepareHtml(realPlan, context());
    const document = parse(output);
    expect(document.querySelector("script")).toBeNull();
    expect(
      [...document.querySelectorAll("a[href]")].every((anchor) =>
        anchor.hasAttribute("data-hs-link"),
      ),
    ).toBe(true);
    const pageCss = document.querySelector("style")?.textContent ?? "";
    expect(pageCss).not.toMatch(/@import/i);
    const originalCss =
      parse(realPlan).querySelector("style")?.textContent ?? "";
    expect(pageCss).toBe(originalCss.replace(/@import[^;]*(;|$)/gi, ""));
    expect(document.querySelector("img")?.getAttribute("src")).toBe(
      "vault://plans/feedflow/diagram.png",
    );
    expect(
      document.querySelector('link[rel="stylesheet"],link[rel="preload"]'),
    ).toBeNull();
    expect(document.documentElement).not.toBeNull();
  });
});
