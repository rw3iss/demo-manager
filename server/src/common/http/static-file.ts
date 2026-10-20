import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { basename, isAbsolute, relative, resolve } from 'node:path';
import type { Request, Response } from 'express';
import { contentTypeFor, isImmutableAsset } from '../util/content-type';
import { injectBaseHref, renderErrorPage } from '../../demos/html.util';

function defaultCache(filePath: string): string {
  if (filePath.toLowerCase().endsWith('.html')) return 'no-cache';
  if (isImmutableAsset(filePath)) return 'public, max-age=31536000, immutable';
  return 'public, max-age=3600';
}

/** True when the request looks like an SPA navigation (→ serve index.html). */
export function isNavigation(req: Request, relPath: string): boolean {
  const accept = String(req.headers['accept'] ?? '');
  const last = relPath.split('/').pop() ?? '';
  return accept.includes('text/html') || !last.includes('.');
}

/** Join + confine to a base dir; null on traversal. */
export function safeJoin(base: string, relPath: string): string | null {
  const clean = relPath.replace(/^\/+/, '');
  const abs = resolve(base, clean);
  const rel = relative(base, abs);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel)) ? abs : null;
}

export function sendHtmlString(res: Response, html: string, status = 200, cacheControl = 'no-cache'): void {
  res.status(status);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', cacheControl);
  res.setHeader('Content-Length', Buffer.byteLength(html));
  res.end(html);
}

export function sendErrorPage(res: Response, status: number, title: string, message: string): void {
  sendHtmlString(res, renderErrorPage(status, title, message), status, 'no-cache');
}

/** Stream a file with correct content-type + caching. Caller has confirmed it exists. */
export async function sendFile(
  req: Request,
  res: Response,
  filePath: string,
  cacheControl?: string,
): Promise<void> {
  const st = await stat(filePath);
  res.status(200);
  res.setHeader('Content-Type', contentTypeFor(filePath));
  res.setHeader('Content-Length', st.size);
  res.setHeader('Cache-Control', cacheControl ?? defaultCache(filePath));
  res.setHeader('Last-Modified', new Date(st.mtimeMs).toUTCString());
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  await new Promise<void>((resolvePromise) => {
    const stream = createReadStream(filePath);
    stream.on('error', () => {
      if (!res.headersSent) res.status(500);
      res.destroy();
      resolvePromise();
    });
    stream.on('end', () => resolvePromise());
    stream.pipe(res);
  });
}

/**
 * Serve `filePath` if it exists. When `injectBase` is given and the file is an
 * index.html, rewrite its `<base href>` (for relative-path SPAs). Returns false
 * if the path doesn't exist or isn't a regular file (caller may SPA-fallback).
 */
export async function serveFileOrFalse(
  req: Request,
  res: Response,
  filePath: string,
  injectBase?: string,
): Promise<boolean> {
  let st;
  try {
    st = await stat(filePath);
  } catch {
    return false;
  }
  if (!st.isFile()) return false;

  if (injectBase && basename(filePath).toLowerCase() === 'index.html') {
    const html = await readFile(filePath, 'utf8');
    sendHtmlString(res, injectBaseHref(html, injectBase), 200, 'no-cache');
  } else {
    await sendFile(req, res, filePath);
  }
  return true;
}
