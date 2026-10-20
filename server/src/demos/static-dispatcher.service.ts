import { Injectable, Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { AppConfigService } from '../config/app-config.service';
import { ManagerServingService } from '../manager/manager-serving.service';
import { sendErrorPage } from '../common/http/static-file';
import { DemoServingService } from './demo-serving.service';

/**
 * Front-of-stack dispatcher (registered as the first Express middleware). It
 * passes API + health requests through to Nest's controllers via `next()`, and
 * handles everything else itself:
 *   `/`            → redirect to the manager
 *   `/manage/**`   → manager SPA
 *   else `/slug/**`→ public demo serving
 *
 * Registering first (rather than last) avoids being shadowed by Nest's own
 * not-found handler; the explicit `next()` keeps the JSON API on Nest.
 */
@Injectable()
export class StaticDispatcher {
  private readonly logger = new Logger('Serving');

  constructor(
    private readonly config: AppConfigService,
    private readonly manager: ManagerServingService,
    private readonly demos: DemoServingService,
  ) {}

  async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
    const base = this.config.managerBasePath;
    const pathname = new URL(req.url, 'http://localhost').pathname;

    // Hand the JSON API and health probe to Nest's controllers.
    if (
      pathname === '/healthz' ||
      pathname.startsWith('/healthz/') ||
      pathname === '/api' ||
      pathname.startsWith('/api/')
    ) {
      return next();
    }

    try {
      if (pathname === '/') {
        res.redirect(302, `${base}/`);
        return;
      }
      if (pathname === base || pathname.startsWith(`${base}/`)) {
        return await this.manager.handle(req, res);
      }
      return await this.demos.handle(req, res);
    } catch (err) {
      this.logger.error(`Serving error for ${req.method} ${pathname}: ${(err as Error).message}`);
      if (!res.headersSent) {
        sendErrorPage(res, 500, 'Something went wrong', 'The server hit an error serving this request.');
      }
    }
  }
}
