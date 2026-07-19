import { cp, mkdir } from "node:fs/promises";
import { URL } from "node:url";

const target = new URL(
  "../dev-vault/.obsidian/plugins/html-shelf/",
  import.meta.url,
);
await mkdir(target, { recursive: true });

for (const filename of ["main.js", "manifest.json", "styles.css"]) {
  await cp(
    new URL(`../${filename}`, import.meta.url),
    new URL(filename, target),
  );
}
