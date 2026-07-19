import type { ShelfSection } from "./model";

export function filterSections(
  sections: ShelfSection[],
  query: string,
): ShelfSection[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return sections;

  const terms = normalized.split(/\s+/);
  return sections.flatMap((section) => {
    const entries = section.entries.filter((entry) => {
      const fields = [entry.title, entry.path, entry.section].map((field) =>
        field.toLowerCase(),
      );
      return terms.every((term) =>
        fields.some((field) => field.includes(term)),
      );
    });
    return entries.length > 0 ? [{ ...section, entries }] : [];
  });
}
