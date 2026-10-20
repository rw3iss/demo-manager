/**
 * Inject `<base href>` into a served index.html so a demo built with relative
 * asset paths resolves correctly under its `/slug/[n]/` subpath, and its
 * client-side router treats that subpath as the app root. Any existing <base>
 * is replaced.
 */
export function injectBaseHref(html: string, href: string): string {
  const stripped = html.replace(/<base\b[^>]*>/gi, '');
  const tag = `<base href="${href}">`;
  if (/<head[^>]*>/i.test(stripped)) {
    return stripped.replace(/(<head[^>]*>)/i, `$1${tag}`);
  }
  if (/<html[^>]*>/i.test(stripped)) {
    return stripped.replace(/(<html[^>]*>)/i, `$1<head>${tag}</head>`);
  }
  return tag + stripped;
}

/** Minimal, self-contained styled error page (matches the manager aesthetic). */
export function renderErrorPage(status: number, title: string, message: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${status} · ${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light; }
  html,body { height:100%; margin:0; }
  body {
    display:grid; place-items:center; min-height:100%;
    background:#eef1f6;
    background-image:radial-gradient(60% 45% at 15% 5%, rgba(83,111,225,.10), transparent 60%),
                     radial-gradient(55% 45% at 85% 18%, rgba(139,221,208,.10), transparent 58%),
                     radial-gradient(75% 55% at 55% 108%, rgba(83,111,225,.08), transparent 60%);
    color:#2b3340; font-family:ui-sans-serif,-apple-system,system-ui,sans-serif;
    -webkit-font-smoothing:antialiased; text-align:center; padding:24px;
  }
  .card { max-width:480px; }
  .code { font-family:ui-monospace,'JetBrains Mono',monospace; font-size:13px;
          letter-spacing:.18em; text-transform:uppercase; color:#3a9eb2; }
  h1 { font-family:ui-sans-serif,-apple-system,system-ui,sans-serif; font-weight:600; font-size:30px;
       margin:12px 0 8px; letter-spacing:-.01em; }
  p { color:#5d6675; line-height:1.6; margin:0 0 24px; }
  a { color:#2b3340; text-decoration:none; font-size:14px;
      border:1px solid rgba(42,58,92,.22); padding:9px 18px; border-radius:10px;
      transition:background .18s ease,border-color .18s ease; }
  a:hover { background:rgba(83,132,194,.12); border-color:rgba(83,132,194,.55); }
</style></head>
<body><div class="card">
  <div class="code">Error ${status}</div>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(message)}</p>
  <a href="/manage">Open demo manager</a>
</div></body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
