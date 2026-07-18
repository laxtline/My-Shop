/** Convert a title to a URL-safe slug. e.g. "Kajaria Floor Tiles 2x2" -> "kajaria-floor-tiles-2x2" */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
