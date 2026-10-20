/**
 * Slugs the public router needs for itself — a project may not claim these,
 * or it would shadow the API / manager / health routes.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  'api',
  'manage',
  'admin',
  'healthz',
  'health',
  'assets',
  'static',
  '_next',
  'favicon.ico',
  'robots.txt',
  '.well-known',
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}
