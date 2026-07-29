import { describe, expect, it, vi } from "vitest";
import type { LinkTarget } from "../../src/core/links";
import {
  createLinkClickHandler,
  findLinkTarget,
  routeLink,
  type PageHistoryEntry,
  type RouteLinkDeps,
} from "../../src/views/navigation";

const taggedTarget = (value: unknown): HTMLElement => {
  const anchor = document.createElement("a");
  anchor.setAttribute("data-hs-link", JSON.stringify(value));
  const child = document.createElement("strong");
  anchor.append(child);
  return child;
};

describe("findLinkTarget", () => {
  it.each<[string, unknown, LinkTarget]>([
    [
      "page",
      { kind: "page", path: "plans/page.html" },
      { kind: "page", path: "plans/page.html" },
    ],
    [
      "page anchor",
      { kind: "page", path: "plans/page.html", anchor: "detail" },
      { kind: "page", path: "plans/page.html", anchor: "detail" },
    ],
    [
      "index",
      { kind: "index", path: "plans/index.html" },
      { kind: "index", path: "plans/index.html" },
    ],
    [
      "anchor",
      { kind: "anchor", anchor: "detail" },
      { kind: "anchor", anchor: "detail" },
    ],
    [
      "external",
      { kind: "external", href: "https://example.com" },
      { kind: "external", href: "https://example.com" },
    ],
    [
      "unsupported",
      { kind: "unsupported", href: "file.pdf" },
      { kind: "unsupported", href: "file.pdf" },
    ],
  ])(
    "parses a valid %s target from a nested click",
    (_label, input, expected) => {
      expect(findLinkTarget(taggedTarget(input))).toEqual(expected);
    },
  );

  it("returns null for an untagged click", () => {
    expect(findLinkTarget(document.createElement("span"))).toBeNull();
    expect(findLinkTarget(document.createTextNode("orphan"))).toBeNull();
  });

  it("finds a tagged anchor from a text-node click target", () => {
    const anchor = document.createElement("a");
    anchor.setAttribute(
      "data-hs-link",
      JSON.stringify({ kind: "anchor", anchor: "detail" }),
    );
    const text = document.createTextNode("Jump");
    anchor.append(text);
    document.body.append(anchor);

    expect(findLinkTarget(text)).toEqual({ kind: "anchor", anchor: "detail" });
  });

  it.each([
    ["malformed JSON", "{"],
    ["null JSON", "null"],
    ["array JSON", "[]"],
    ["wrong shape", JSON.stringify({ kind: "page", path: 42 })],
    [
      "wrong page anchor",
      JSON.stringify({ kind: "page", path: "page.html", anchor: 42 }),
    ],
    ["wrong anchor", JSON.stringify({ kind: "anchor", anchor: 42 })],
    ["unknown kind", JSON.stringify({ kind: "video", path: "page.html" })],
    [
      "forged external",
      JSON.stringify({ kind: "external", href: "javascript:alert(1)" }),
    ],
    [
      "protocol-relative external",
      JSON.stringify({ kind: "external", href: "//example.com" }),
    ],
    ["non-string external", JSON.stringify({ kind: "external", href: 42 })],
    ["absolute page", JSON.stringify({ kind: "page", path: "/page.html" })],
    ["escaping page", JSON.stringify({ kind: "page", path: "../page.html" })],
    ["bad encoding", JSON.stringify({ kind: "page", path: "%ZZ.html" })],
    ["non-HTML page", JSON.stringify({ kind: "page", path: "page.pdf" })],
    [
      "page disguised as index",
      JSON.stringify({ kind: "page", path: "index.html" }),
    ],
    [
      "index with wrong basename",
      JSON.stringify({ kind: "index", path: "page.html" }),
    ],
  ])("downgrades %s to unsupported", (_label, attribute) => {
    const anchor = document.createElement("a");
    anchor.setAttribute("data-hs-link", attribute);
    expect(findLinkTarget(anchor)?.kind).toBe("unsupported");
  });

  it("uses the same delegated handler to prevent and route tagged clicks", () => {
    const anchor = document.createElement("a");
    anchor.href = "#";
    anchor.setAttribute(
      "data-hs-link",
      JSON.stringify({ kind: "anchor", anchor: "detail" }),
    );
    const child = document.createElement("span");
    anchor.append(child);
    document.body.append(anchor);
    const routed: LinkTarget[] = [];
    document.addEventListener(
      "click",
      createLinkClickHandler((target) => {
        routed.push(target);
      }),
      { once: true },
    );
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });

    child.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(routed).toEqual([{ kind: "anchor", anchor: "detail" }]);
  });
});

const createRouteHarness = (overrides: Partial<RouteLinkDeps> = {}) => {
  const history: PageHistoryEntry[] = [];
  const openFile = vi.fn<(path: string, anchor?: string) => Promise<void>>(() =>
    Promise.resolve(),
  );
  const deps: RouteLinkDeps = {
    currentPath: "plans/current.html",
    currentScrollY: 72,
    history,
    pageExists: () => true,
    openFile,
    activateShelf: vi.fn(() => Promise.resolve()),
    openExternal: vi.fn(),
    notice: vi.fn(),
    scrollToAnchor: vi.fn(),
    ...overrides,
  };
  return { deps, history, openFile };
};

describe("routeLink", () => {
  it("pushes the current page and opens an internal page with its anchor", async () => {
    const { deps, history, openFile } = createRouteHarness();

    await routeLink(
      { kind: "page", path: "plans/next.html", anchor: "detail" },
      deps,
    );

    expect(history).toEqual([{ path: "plans/current.html", scrollY: 72 }]);
    expect(openFile).toHaveBeenCalledWith("plans/next.html", "detail");
  });

  it("notices a missing page without mutating history", async () => {
    const { deps, history, openFile } = createRouteHarness({
      pageExists: () => false,
    });

    await routeLink({ kind: "page", path: "plans/missing.html" }, deps);

    expect(history).toEqual([]);
    expect(openFile).not.toHaveBeenCalled();
    expect(deps.notice).toHaveBeenCalledWith(
      "Linked page not found: plans/missing.html",
    );
  });

  it("rolls history back when opening a page fails", async () => {
    const { deps, history } = createRouteHarness({
      openFile: () => Promise.reject(new Error("open failed")),
    });

    await expect(
      routeLink({ kind: "page", path: "plans/next.html" }, deps),
    ).rejects.toThrow("open failed");

    expect(history).toEqual([]);
  });

  it("opens without history when there is no current page", async () => {
    const { deps, history, openFile } = createRouteHarness({
      currentPath: null,
    });

    await routeLink({ kind: "page", path: "plans/next.html" }, deps);

    expect(history).toEqual([]);
    expect(openFile).toHaveBeenCalledWith("plans/next.html", undefined);
  });

  it("does not pop history for a failed first-page open", async () => {
    const history: PageHistoryEntry[] = [];
    const pop = vi.spyOn(history, "pop");
    const { deps } = createRouteHarness({
      currentPath: null,
      history,
      openFile: () => Promise.reject(new Error("open failed")),
    });

    await expect(
      routeLink({ kind: "page", path: "plans/next.html" }, deps),
    ).rejects.toThrow("open failed");
    expect(pop).not.toHaveBeenCalled();
  });

  it("handles self links without reopening or pushing history", async () => {
    const { deps, history, openFile } = createRouteHarness();

    await routeLink(
      { kind: "page", path: "plans/current.html", anchor: "detail" },
      deps,
    );
    await routeLink({ kind: "page", path: "plans/current.html" }, deps);

    expect(history).toEqual([]);
    expect(openFile).not.toHaveBeenCalled();
    expect(deps.scrollToAnchor).toHaveBeenCalledOnce();
    expect(deps.scrollToAnchor).toHaveBeenCalledWith("detail");
  });

  it("routes index, anchor, external, and unsupported targets", async () => {
    const { deps } = createRouteHarness();

    await routeLink({ kind: "index", path: "plans/index.html" }, deps);
    await routeLink({ kind: "anchor", anchor: "detail" }, deps);
    await routeLink({ kind: "external", href: "https://example.com" }, deps);
    await routeLink({ kind: "unsupported", href: "page.pdf" }, deps);

    expect(deps.activateShelf).toHaveBeenCalledOnce();
    expect(deps.scrollToAnchor).toHaveBeenCalledWith("detail");
    expect(deps.openExternal).toHaveBeenCalledWith("https://example.com");
    expect(deps.notice).toHaveBeenCalledWith(
      "This link type can't be opened here.",
    );
  });
});
