import { normalizeHrefForScheme, resolveRelative } from "./links";

const IMAGE_MIME_TYPES: Record<string, string> = {
  avif: "image/avif",
  bmp: "image/bmp",
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  webp: "image/webp",
};

export const MAX_INLINED_IMAGE_BYTES = 2 * 1024 * 1024;

export function resolveRelativeResourcePath(
  value: string,
  filePath: string,
): string | null {
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
}

export function collectRelativeImagePaths(
  raw: string,
  filePath: string,
): string[] {
  const document = new DOMParser().parseFromString(raw, "text/html");
  const paths = new Set<string>();
  for (const element of document.querySelectorAll("img[src],input[src]")) {
    if (
      element.localName === "input" &&
      element.getAttribute("type")?.toLowerCase() !== "image"
    ) {
      continue;
    }
    const source = element.getAttribute("src");
    if (source === null) continue;
    const path = resolveRelativeResourcePath(source, filePath);
    if (path) paths.add(path);
  }
  return [...paths];
}

export function imageDataUrl(
  path: string,
  data: ArrayBuffer,
  maxBytes = MAX_INLINED_IMAGE_BYTES,
): string | null {
  if (data.byteLength > maxBytes) return null;
  const extension = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  const mime = IMAGE_MIME_TYPES[extension];
  if (!mime) return null;

  const bytes = new Uint8Array(data);
  let binary = "";
  const chunkSize = 32_768;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + chunkSize),
    );
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

export async function loadInlineImageUrls(
  raw: string,
  filePath: string,
  readBinary: (path: string) => Promise<ArrayBuffer | null>,
): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  await Promise.all(
    collectRelativeImagePaths(raw, filePath).map(async (path) => {
      try {
        const data = await readBinary(path);
        if (!data) return;
        const url = imageDataUrl(path, data);
        if (url) urls.set(path, url);
      } catch {
        // Leave unreadable images on the normal resource URL fallback.
      }
    }),
  );
  return urls;
}
