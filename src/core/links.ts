export type LinkTarget =
  | { kind: "page"; path: string; anchor?: string }
  | { kind: "index"; path: string }
  | { kind: "anchor"; anchor: string }
  | { kind: "external"; href: string }
  | { kind: "unsupported"; href: string };

export const normalizeHrefForScheme = (href: string): string =>
  [...href]
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code > 0x20 && code !== 0x7f;
    })
    .join("");

export function resolveRelative(
  baseFilePath: string,
  relative: string,
): string | null {
  const rawPath = relative.split("#", 1)[0]!.split("?", 1)[0]!;
  if (rawPath.startsWith("/") || rawPath.startsWith("\\")) return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return null;
  }

  decoded = decoded.replace(/\\/g, "/");
  if (decoded.startsWith("/")) return null;

  const base = baseFilePath.replace(/\\/g, "/").split("/");
  base.pop();
  for (const segment of decoded.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      if (base.length === 0) return null;
      base.pop();
    } else {
      base.push(segment);
    }
  }
  return base.join("/") || null;
}

export function classifyHref(
  href: string,
  currentFilePath: string,
): LinkTarget {
  const raw = href.trim();
  const schemeSafe = normalizeHrefForScheme(raw);
  if (!schemeSafe) return { kind: "unsupported", href };

  if (schemeSafe.startsWith("//")) {
    return { kind: "external", href: `https:${schemeSafe}` };
  }

  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(schemeSafe)?.[1]?.toLowerCase();
  if (scheme) {
    if (["http", "https", "mailto", "tel"].includes(scheme)) {
      return { kind: "external", href: schemeSafe };
    }
    return { kind: "unsupported", href };
  }

  if (raw.startsWith("#")) {
    return { kind: "anchor", anchor: raw.slice(1) };
  }
  if (raw.startsWith("/")) return { kind: "unsupported", href };

  const hashIndex = raw.indexOf("#");
  const rawAnchor = hashIndex === -1 ? undefined : raw.slice(hashIndex + 1);
  const withoutFragment = hashIndex === -1 ? raw : raw.slice(0, hashIndex);
  const queryIndex = withoutFragment.indexOf("?");
  const rawPath =
    queryIndex === -1 ? withoutFragment : withoutFragment.slice(0, queryIndex);
  const path = resolveRelative(currentFilePath, rawPath);
  if (!path || !/\.html?$/i.test(path)) return { kind: "unsupported", href };

  const basename = path.slice(path.lastIndexOf("/") + 1);
  if (/^index\.html?$/i.test(basename)) return { kind: "index", path };

  return rawAnchor === undefined
    ? { kind: "page", path }
    : { kind: "page", path, anchor: rawAnchor };
}
