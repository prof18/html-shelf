const normalizeText = (text: string | null): string =>
  (text ?? "").replace(/\s+/g, " ").trim();

const humanize = (basename: string): string => {
  const words = basename
    .replace(/\.html?$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return words ? words[0]!.toUpperCase() + words.slice(1) : "Untitled";
};

const capTitle = (title: string): string =>
  title.length > 120 ? `${title.slice(0, 119)}…` : title;

export function extractTitleTag(htmlPrefix: string): string | null {
  if (!htmlPrefix.toLowerCase().includes("</title>")) return null;
  const document = new DOMParser().parseFromString(htmlPrefix, "text/html");
  const title = normalizeText(
    document.querySelector("title")?.textContent ?? null,
  );
  return title ? capTitle(title) : null;
}

export function deriveTitle(html: string, fallbackBasename: string): string {
  const document = new DOMParser().parseFromString(html, "text/html");
  const title = normalizeText(
    document.querySelector("title")?.textContent ?? null,
  );
  const heading = normalizeText(
    document.querySelector("h1")?.textContent ?? null,
  );
  return capTitle(title || heading || humanize(fallbackBasename));
}
