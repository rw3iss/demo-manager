/**
 * Inject the PageLoop widget into an HTML document — the single loader <script>
 * tag that `pageloop inject` writes. The loader (`/cdn/loader/pageloop-loader.js`)
 * pulls the current widget bundle AND its stylesheet, then calls `PageLoop.init`
 * with the project/endpoint from its `data-*` attributes, and self-updates
 * (rolling back on a bad release). Carries the `data-pageloop-injected` marker so
 * it stays idempotent and `uninjectPageloopSnippet` can strip it back out.
 *
 * Done inline (emitting the same tag the CLI does, not shelling out to it) so
 * injection has no cross-process/cross-install dependency and works the same in
 * dev, tests, and prod. NOTE: injecting only the bundle (`pageloop.umd.js`) with
 * a hand-rolled `PageLoop.init` skips the stylesheet, leaving the widget
 * unstyled/invisible — always inject the loader. See docs/ARCHITECTURE.md.
 */
const MARKER = 'data-pageloop-injected';

export interface PageloopInjectOptions {
  endpoint: string; // e.g. https://pageloop.ryanweiss.net
  projectId: string; // the PageLoop project id the widget binds to
  channel?: string; // loader update channel: 'latest' (default), '<major>.<minor>', or a pinned version
}

/** True if the document already carries the injected marker. */
export function hasPageloopSnippet(html: string): boolean {
  return html.includes(MARKER);
}

/** Return `html` with the PageLoop loader snippet inserted; a no-op if already present. */
export function injectPageloopSnippet(html: string, opts: PageloopInjectOptions): string {
  if (hasPageloopSnippet(html)) return html;

  const endpoint = opts.endpoint.replace(/\/+$/, '');
  const loaderUrl = `${endpoint}/cdn/loader/pageloop-loader.js`;
  const channel = opts.channel ?? 'latest';
  const snippet =
    `\n  <script src="${escapeAttr(loaderUrl)}"` +
    ` data-project="${escapeAttr(opts.projectId)}"` +
    ` data-endpoint="${escapeAttr(endpoint)}"` +
    ` data-channel="${escapeAttr(channel)}"` +
    ` async ${MARKER}="1"></script>\n`;

  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${snippet}</head>`);
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${snippet}</body>`);
  return html + snippet;
}

/**
 * Remove a previously-injected PageLoop snippet — strips exactly the
 * `data-pageloop-injected*` tags (bundle script, init script, and the optional
 * css link), matching `pageloop uninject`. A no-op if none are present.
 */
export function uninjectPageloopSnippet(html: string): string {
  if (!hasPageloopSnippet(html)) return html;
  return html
    .replace(/[ \t]*<script\b[^>]*\bdata-pageloop-injected(?:-init)?="1"[^>]*>[\s\S]*?<\/script>\s*/gi, '\n')
    .replace(/[ \t]*<link\b[^>]*\bdata-pageloop-injected-css="1"[^>]*>\s*/gi, '\n');
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
