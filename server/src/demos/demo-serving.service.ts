import { readFile } from 'node:fs/promises';
import { Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { StorageService } from '../storage/storage.service';
import {
  isNavigation,
  sendErrorPage,
  sendHtmlString,
  serveFileOrFalse,
} from '../common/http/static-file';
import { injectBaseHref } from './html.util';
import { DemoResolverService } from './demo-resolver.service';

/**
 * Serves a public demo request `/<slug>/…`: resolve → 302 the bare project root
 * to the current version's `/<slug>/<n>/` URL, else stream the file, or SPA
 * fallback to the version's index.html (with injected `<base href>`), or a
 * styled 404. Writes directly to the Express response (bypasses Nest's
 * controller pipeline), so the success/error envelope does not apply here.
 */
@Injectable()
export class DemoServingService {
  constructor(
    private readonly resolver: DemoResolverService,
    private readonly storage: StorageService,
  ) {}

  async handle(req: Request, res: Response): Promise<void> {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return sendErrorPage(res, 405, 'Method not allowed', 'Demos are read-only.');
    }

    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const segments = pathname.split('/').filter(Boolean);
    const slug = segments[0];
    if (!slug) return sendErrorPage(res, 404, 'Not found', 'No demo at this path.');

    const resolution = await this.resolver.resolve(slug, segments.slice(1));
    if (resolution.kind === 'not_found') {
      return sendErrorPage(res, 404, 'Demo not found', resolution.reason);
    }
    if (resolution.kind === 'redirect') {
      // 302, not 301: the current version is mutable, so the target must not be
      // cached as permanent. Preserve any query string (e.g. ?pl-comment=…).
      const q = req.url.indexOf('?');
      const location = resolution.location + (q >= 0 ? req.url.slice(q) : '');
      res.setHeader('Cache-Control', 'no-store');
      res.redirect(302, location);
      return;
    }

    const { versionNumber, assetRelPath, baseHref } = resolution;
    const relPath = assetRelPath === '' ? 'index.html' : assetRelPath;

    const abs = this.storage.resolveAsset(slug, versionNumber, relPath);
    if (!abs) return sendErrorPage(res, 404, 'Not found', 'Invalid path.');

    if (await serveFileOrFalse(req, res, abs, baseHref)) return;

    // SPA fallback: deep client routes resolve to the version's index.html.
    if (isNavigation(req, relPath)) {
      const indexPath = this.storage.indexPath(slug, versionNumber);
      try {
        const html = await readFile(indexPath, 'utf8');
        return sendHtmlString(res, injectBaseHref(html, baseHref), 200, 'no-cache');
      } catch {
        return sendErrorPage(res, 404, 'Demo not found', 'This version has no index.html.');
      }
    }

    return sendErrorPage(res, 404, 'Not found', `"${relPath}" was not found in this demo.`);
  }
}
