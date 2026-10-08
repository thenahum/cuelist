/**
 * Produces a comparison form for user-entered search text. Keeping this
 * forgiving lets a query typed on a mobile keyboard match typographic
 * apostrophes, accents, dashes, and other formatting differences in saved
 * content.
 */
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[’‘`´]/gu, "'")
    .replace(/['’]/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLocaleLowerCase();
}

export function includesSearchText(
  value: string | undefined,
  normalizedQuery: string,
): boolean {
  return Boolean(value && normalizeSearchText(value).includes(normalizedQuery));
}
