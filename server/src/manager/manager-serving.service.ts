import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppConfigService } from '../config/app-config.service';
import {
  isNavigation,
  safeJoin,
  sendErrorPage,
  sendFile,
  serveFileOrFalse,
} from '../common/http/static-file';

/**
 * Serves the built manager SPA (client/dist) under MANAGER_BASE_PATH. The
 * client is built with Vite `base: '/manage/'`, so its asset links are already
 * correct — no `<base>` injection needed here, just file serving + SPA
 * fallback to index.html for client-side routes.
 */
@Injectable()
export class ManagerServingService {
  constructor(private readonly config: AppConfigService) {}

  private get dist(): string {
    return this.config.clientDistPath;
  }

  async handle(req: Request, res: Response): Promise<void> {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return sendErrorPage(res, 405, 'Method not allowed', 'The manager UI is read-only over HTTP.');
    }

    const base = this.config.managerBasePath; // e.g. '/manage'
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let rel = pathname.slice(base.length).replace(/^\/+/, '');
    if (rel === '') rel = 'index.html';

    const abs = safeJoin(this.dist, rel);
    if (abs && (await serveFileOrFalse(req, res, abs))) return;

    if (isNavigation(req, rel)) {
      try {
        return await sendFile(req, res, join(this.dist, 'index.html'), 'no-cache');
      } catch {
        return sendErrorPage(
          res,
          500,
          'Manager UI unavailable',
          'The manager bundle was not found. Build the client (npm --prefix client run build) or set CLIENT_DIST_PATH.',
        );
      }
    }

    return sendErrorPage(res, 404, 'Not found', `"${rel}" was not found.`);
  }
}
