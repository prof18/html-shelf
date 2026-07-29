import {
  normalizeHrefForScheme,
  resolveRelative,
  type LinkTarget,
} from "../core/links";

export interface PageHistoryEntry {
  path: string;
  scrollY: number;
}

export interface RouteLinkDeps {
  currentPath: string | null;
  currentScrollY: number;
  history: PageHistoryEntry[];
  pageExists: (path: string) => boolean;
  openFile: (path: string, anchor?: string) => Promise<void>;
  activateShelf: () => Promise<void>;
  openExternal: (href: string) => void;
  notice: (message: string) => void;
  scrollToAnchor: (anchor: string) => void;
}

const unsupported = (href = ""): LinkTarget => ({
  kind: "unsupported",
  href,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const validatedVaultPath = (path: unknown): string | null => {
  if (typeof path !== "string") return null;
  const normalized = resolveRelative("", path);
  if (
    normalized === null ||
    normalized !== path ||
    !/\.html?$/i.test(normalized)
  ) {
    return null;
  }
  return normalized;
};

const validateTarget = (value: unknown, raw: string): LinkTarget => {
  if (!isRecord(value) || typeof value.kind !== "string") {
    return unsupported(raw);
  }

  if (value.kind === "page") {
    const path = validatedVaultPath(value.path);
    const anchor = value.anchor;
    if (
      path === null ||
      /^index\.html?$/i.test(path.slice(path.lastIndexOf("/") + 1)) ||
      (anchor !== undefined && typeof anchor !== "string")
    ) {
      return unsupported(raw);
    }
    return anchor === undefined
      ? { kind: "page", path }
      : { kind: "page", path, anchor };
  }

  if (value.kind === "index") {
    const path = validatedVaultPath(value.path);
    if (
      path === null ||
      !/^index\.html?$/i.test(path.slice(path.lastIndexOf("/") + 1))
    ) {
      return unsupported(raw);
    }
    return { kind: "index", path };
  }

  if (value.kind === "anchor" && typeof value.anchor === "string") {
    return { kind: "anchor", anchor: value.anchor };
  }

  if (value.kind === "external" && typeof value.href === "string") {
    const href = normalizeHrefForScheme(value.href);
    if (/^(https?|mailto|tel):/i.test(href)) {
      return { kind: "external", href };
    }
    return unsupported(raw);
  }

  if (value.kind === "unsupported" && typeof value.href === "string") {
    return { kind: "unsupported", href: value.href };
  }

  return unsupported(raw);
};

export function findLinkTarget(
  eventTarget: EventTarget | null,
): LinkTarget | null {
  const node = eventTarget as Node | null;
  const element =
    node?.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : (node?.parentElement ?? null);
  const anchor = element?.closest("a[data-hs-link]");
  if (!anchor) return null;

  const raw = anchor.getAttribute("data-hs-link") ?? "";
  try {
    return validateTarget(JSON.parse(raw), raw);
  } catch {
    return unsupported(raw);
  }
}

export const createLinkClickHandler =
  (route: (target: LinkTarget) => void | Promise<void>): EventListener =>
  (event) => {
    const target = findLinkTarget(event.target);
    if (target === null) return;
    event.preventDefault();
    void route(target);
  };

export async function routeLink(
  target: LinkTarget,
  deps: RouteLinkDeps,
): Promise<void> {
  if (target.kind === "page") {
    if (target.path === deps.currentPath) {
      if (target.anchor !== undefined) deps.scrollToAnchor(target.anchor);
      return;
    }
    if (!deps.pageExists(target.path)) {
      deps.notice(`Linked page not found: ${target.path}`);
      return;
    }

    const previous =
      deps.currentPath === null
        ? null
        : { path: deps.currentPath, scrollY: deps.currentScrollY };
    if (previous) deps.history.push(previous);
    try {
      await deps.openFile(target.path, target.anchor);
    } catch (error) {
      if (previous) deps.history.pop();
      throw error;
    }
    return;
  }

  if (target.kind === "index") {
    await deps.activateShelf();
    return;
  }
  if (target.kind === "anchor") {
    deps.scrollToAnchor(target.anchor);
    return;
  }
  if (target.kind === "external") {
    deps.openExternal(target.href);
    return;
  }
  deps.notice("This link type can't be opened here.");
}
