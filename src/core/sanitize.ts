import { resolveRelativeResourcePath } from "./assets";
import { classifyHref, normalizeHrefForScheme } from "./links";

export interface SanitizeContext {
  filePath: string;
  mobile: boolean;
  resourceUrl: (vaultPath: string) => string;
  theme: "light" | "dark";
}

const navigableAttributes = new Set(["href", "src", "xlink:href"]);

const rewriteAttribute = (
  element: Element,
  attribute: string,
  context: SanitizeContext,
): void => {
  const value = element.getAttribute(attribute)!;
  const path = resolveRelativeResourcePath(value, context.filePath);
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
      resolveRelativeResourcePath(href, context.filePath) === null
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
  const rootStyle = document.documentElement.getAttribute("style")?.trim();
  document.documentElement.setAttribute(
    "style",
    `${rootStyle ? `${rootStyle.replace(/;?$/, ";")}` : ""}color-scheme:${context.theme}`,
  );
  if (context.mobile) {
    document.documentElement.setAttribute("data-hs-mobile", "true");
    const clearance = new DOMParser().parseFromString(
      '<div class="hs-mobile-clearance" aria-hidden="true" style="display:block!important;width:100%!important;height:112px!important;min-height:112px!important;flex:0 0 112px!important;pointer-events:none!important"></div>',
      "text/html",
    ).body.firstElementChild;
    if (clearance) document.body.append(clearance);
  }

  return `<!DOCTYPE html>${document.documentElement.outerHTML}`;
}
