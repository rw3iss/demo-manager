/**
 * Lowercase kebab-case slug derivation + validation. Slugs are the public URL
 * key for a project (`/<slug>/`), so they must be filesystem- and URL-safe.
 */

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Combining diacritical marks (U+0300-U+036F), stripped after NFKD normalize.
const COMBINING_MARKS_RE = /[\u0300-\u036f]/g;

/** Derive a slug from arbitrary text (e.g. a project name). */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(COMBINING_MARKS_RE, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-') // non-alphanumerics -> hyphen
    .replace(/^-+|-+$/g, '') // trim leading/trailing hyphens
    .slice(0, 63);
}

/** A valid slug: lowercase alphanumerics separated by single hyphens, 1-63 chars. */
export function isValidSlug(slug: string): boolean {
  return slug.length >= 1 && slug.length <= 63 && SLUG_RE.test(slug);
}
