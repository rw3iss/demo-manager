/** Current Unix time in whole seconds (platform-wide timestamp convention). */
export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}
