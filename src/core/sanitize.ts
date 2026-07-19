import { classifyHref, normalizeHrefForScheme, resolveRelative } from "./links";

export interface SanitizeContext {
  filePath: string;
  resourceUrl: (vaultPath: string) => string;
  theme: "light" | "dark";
}

const navigableAttributes = new Set(["href", "src", "xlink:href"]);

const relativeResourcePath = (
  value: string,
  filePath: string,
): string | null => {
  const schemeSafe = normalizeHrefForScheme(value);
  if (
    !value ||
    value.startsWith("/") ||
    value.startsWith("#") ||
    schemeSafe.startsWith("//") ||
    /^[a-z][a-z0-9+.-]*:/i.test(schemeSafe)
  ) {
    return null;
  }
  return resolveRelative(filePath, value);
};

const rewriteAttribute = (
  element: Element,
  attribute: string,
  context: SanitizeContext,
): void => {
  const value = element.getAttribute(attribute)!;
  const path = relativeResourcePath(value, context.filePath);
  if (path) element.setAttribute(attribute, context.resourceUrl(path));
};

export function prepareHtml(raw: string, context: SanitizeContext): string {
  const document = new DOMParser().parseFromString(raw, "text/html");

  for (const element of document.querySelectorAll(
    "script,object,embed,applet,iframe,base",
  )) {
    element.remove();
  }
  for (const meta of document.querySelectorAll("meta[http-equiv]")) {
    if (meta.getAttribute("http-equiv")!.toLowerCase() === "refresh")
      meta.remove();
  }

  for (const element of document.querySelectorAll("*")) {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      if (
        name.startsWith("on") ||
        name.startsWith("data-hs-") ||
        name === "formaction"
      ) {
        element.removeAttribute(attribute.name);
      } else if (
        navigableAttributes.has(name) &&
        normalizeHrefForScheme(attribute.value)
          .toLowerCase()
          .startsWith("javascript:")
      ) {
        element.removeAttribute(attribute.name);
      }
    }

    if (element.localName === "form") element.setAttribute("action", "#");
    if (element.localName === "a") element.removeAttribute("ping");
  }

  for (const use of document.querySelectorAll("use")) {
    const href = use.getAttribute("href") ?? use.getAttribute("xlink:href");
    if (!href?.startsWith("#")) use.remove();
  }

  for (const link of document.querySelectorAll("link")) {
    const href = link.getAttribute("href");
    const rels = (link.getAttribute("rel") ?? "").toLowerCase().split(/\s+/);
    if (
      href === null ||
      !rels.includes("stylesheet") ||
      relativeResourcePath(href, context.filePath) === null
    ) {
      link.remove();
    }
  }

  for (const style of document.querySelectorAll("style")) {
    style.textContent = style.textContent.replace(/@import[^;]*(;|$)/gi, "");
  }

  const assetAttributes: [string, string][] = [
    ["img[src]", "src"],
    ["source[src]", "src"],
    ["video[src]", "src"],
    ["audio[src]", "src"],
    ["track[src]", "src"],
    ["video[poster]", "poster"],
    ['input[type="image"][src]', "src"],
    ['link[rel~="stylesheet"][href]', "href"],
  ];
  for (const [selector, attribute] of assetAttributes) {
    for (const element of document.querySelectorAll(selector)) {
      rewriteAttribute(element, attribute, context);
    }
  }
  for (const element of document.querySelectorAll("[srcset]")) {
    element.removeAttribute("srcset");
  }

  for (const element of document.querySelectorAll("a,area")) {
    const href =
      element.getAttribute("href") ?? element.getAttribute("xlink:href");
    if (href === null) continue;
    element.setAttribute(
      "data-hs-link",
      JSON.stringify(classifyHref(href, context.filePath)),
    );
    element.setAttribute("href", "#");
    element.removeAttribute("xlink:href");
    element.removeAttribute("target");
  }

  for (const element of document.querySelectorAll("[href],[xlink\\:href]")) {
    if (
      element.localName !== "a" &&
      element.localName !== "area" &&
      element.localName !== "link" &&
      element.localName !== "use"
    ) {
      element.removeAttribute("href");
      element.removeAttribute("xlink:href");
    }
  }

  document.documentElement.setAttribute("data-hs-theme", context.theme);
  const themeStyle = document.createElement("style");
  themeStyle.textContent =
    ':root[data-hs-theme="dark"]{color-scheme:dark}:root[data-hs-theme="light"]{color-scheme:light}';
  document.head.append(themeStyle);

  return `<!DOCTYPE html>${document.documentElement.outerHTML}`;
}
