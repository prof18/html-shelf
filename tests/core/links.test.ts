import { describe, expect, it } from "vitest";
import {
  classifyHref,
  normalizeHrefForScheme,
  resolveRelative,
} from "../../src/core/links";

describe("normalizeHrefForScheme", () => {
  it("removes ASCII controls and whitespace", () => {
    expect(normalizeHrefForScheme(" jav\t\nascript: alert(1) ")).toBe(
      "javascript:alert(1)",
    );
  });
});

describe("resolveRelative", () => {
  it.each([
    ["plans/feedflow/a.html", "b.html", "plans/feedflow/b.html"],
    ["plans/feedflow/a.html", "./b.html", "plans/feedflow/b.html"],
    [
      "plans/feedflow/a.html",
      "../readerflow/b.html",
      "plans/readerflow/b.html",
    ],
    ["a/b/c/page.html", "../../x.html", "a/x.html"],
    ["plans/a.html", "my%20plan.html", "plans/my plan.html"],
    ["plans/a.html", "my%23notes.html", "plans/my#notes.html"],
    ["plans/a.html", "my%3Fnotes.html", "plans/my?notes.html"],
  ])("resolves %s + %s", (base, relative, expected) => {
    expect(resolveRelative(base, relative)).toBe(expected);
  });

  it("strips query and fragment before decoding", () => {
    expect(resolveRelative("plans/a.html", "b.html?x=1#section")).toBe(
      "plans/b.html",
    );
  });

  it.each(["../../../x.html", "/root.html", "b%zz.html"])(
    "returns null for invalid relative %s",
    (relative) => expect(resolveRelative("plans/a.html", relative)).toBeNull(),
  );

  it("rejects encoded absolute paths and empty resolutions", () => {
    expect(resolveRelative("plans/a.html", "%5Croot.html")).toBeNull();
    expect(resolveRelative("a.html", ".")).toBeNull();
  });
});

describe("classifyHref", () => {
  const current = "plans/feedflow/a.html";

  it.each([
    ["b.html", { kind: "page", path: "plans/feedflow/b.html" }],
    ["./b.html", { kind: "page", path: "plans/feedflow/b.html" }],
    ["../readerflow/b.html", { kind: "page", path: "plans/readerflow/b.html" }],
    [
      "b.html#section",
      { kind: "page", path: "plans/feedflow/b.html", anchor: "section" },
    ],
    ["b.html?x=1", { kind: "page", path: "plans/feedflow/b.html" }],
    [
      "b.html?x=1#s",
      { kind: "page", path: "plans/feedflow/b.html", anchor: "s" },
    ],
    ["my%23notes.html", { kind: "page", path: "plans/feedflow/my#notes.html" }],
    ["Beta-Plan.HTML", { kind: "page", path: "plans/feedflow/Beta-Plan.HTML" }],
  ])("classifies local page %s", (href, expected) => {
    expect(classifyHref(href, current)).toEqual(expected);
  });

  it("classifies same-document anchors", () => {
    expect(classifyHref("#top", current)).toEqual({
      kind: "anchor",
      anchor: "top",
    });
  });

  it.each(["index.html", "../index.html", "../INDEX.HTM"])(
    "classifies index target %s",
    (href) => expect(classifyHref(href, current).kind).toBe("index"),
  );

  it.each([
    "https://example.com/page",
    "HTTP://example.com/page",
    "mailto:test@example.com",
    "tel:+49123",
  ])("classifies external target %s", (href) => {
    expect(classifyHref(href, current)).toEqual({ kind: "external", href });
  });

  it("normalizes protocol-relative targets to HTTPS", () => {
    expect(classifyHref("//example.com/x.html", current)).toEqual({
      kind: "external",
      href: "https://example.com/x.html",
    });
  });

  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "jav\tascript:alert(1)",
    "data:text/html,hello",
    "file:///etc/passwd",
    "obsidian://open",
    "/foo.html",
    "diagram.png",
    "../../../x.html",
    "b%zz.html",
    "",
  ])("classifies unsupported target %j", (href) => {
    expect(classifyHref(href, current)).toEqual({ kind: "unsupported", href });
  });

  it("preserves resolved path casing instead of fuzzy matching", () => {
    expect(classifyHref("beta-plan.html", current)).toEqual({
      kind: "page",
      path: "plans/feedflow/beta-plan.html",
    });
    expect(classifyHref("Beta-Plan.HTML", current)).not.toEqual({
      kind: "page",
      path: "plans/feedflow/beta-plan.html",
    });
  });
});
