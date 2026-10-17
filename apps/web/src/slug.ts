/**
 * URL-safe slug: NFKD-stripped diacritics, lowercase alnum joined by single
 * dashes, trimmed and capped at `maxLength`. Shared by content entries and
 * commerce products.
 */
export function slugify(value: string, maxLength = 120): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}
