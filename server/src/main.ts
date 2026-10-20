import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';
import { StorageService } from './storage/storage.service';
import { StaticDispatcher } from './demos/static-dispatcher.service';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(AppConfigService);

  // API cross-cutting concerns (apply to Nest controllers only).
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  const origins = config.corsOrigins;
  app.enableCors({ origin: origins === '*' ? true : origins, credentials: true });

  // Make sure the demos root exists before we start serving from it.
  await app.get(StorageService, { strict: false }).ensureRoot();

  // Register the static/demo dispatcher as the FIRST Express middleware. It
  // passes /api + /healthz through to Nest (next()) and serves the manager SPA,
  // demos, and redirects itself. Registering first keeps it from being shadowed
  // by Nest's not-found handler.
  const dispatcher = app.get(StaticDispatcher, { strict: false });
  const http = app.getHttpAdapter().getInstance();
  http.use((req: Request, res: Response, next: NextFunction) => {
    void dispatcher.handle(req, res, next);
  });

  await app.listen(config.port, config.host);
  new Logger('Bootstrap').log(
    `demo-manager on http://${config.host}:${config.port} · manager ${config.managerBasePath} · demos root ${config.demosRoot}`,
  );
}

void bootstrap();
