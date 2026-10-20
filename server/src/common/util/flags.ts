/** Coerce a multipart/string flag to boolean, with a default when absent. */
export function parseBoolFlag(value: string | boolean | undefined, fallback: boolean): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  return !['false', '0', 'no', 'off', ''].includes(value.trim().toLowerCase());
}
