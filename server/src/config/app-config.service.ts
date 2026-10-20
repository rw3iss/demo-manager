import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { configuration, type AppConfig } from './configuration';

/**
 * Typed accessor for the application config. Single place the rest of the app
 * reads settings from, so consumers depend on a small typed surface rather than
 * stringly-typed `ConfigService.get('a.b.c')` calls scattered everywhere.
 */
@Injectable()
export class AppConfigService {
  private readonly cfg: AppConfig;

  constructor(config: ConfigService) {
    // `load: [configuration]` registers the same object; resolve once here for
    // a fully-typed view (ConfigService loses the nested types).
    this.cfg = config.get<AppConfig>('config') ?? configuration();
  }

  get all(): AppConfig {
    return this.cfg;
  }

  get isProd(): boolean {
    return this.cfg.isProd;
  }
  get port(): number {
    return this.cfg.port;
  }
  get host(): string {
    return this.cfg.host;
  }
  get corsOrigins(): string[] | '*' {
    return this.cfg.corsOrigins;
  }
  get publicBaseUrl(): string {
    return this.cfg.publicBaseUrl;
  }

  get demosRoot(): string {
    return this.cfg.storage.demosRoot;
  }
  get clientDistPath(): string {
    return this.cfg.storage.clientDistPath;
  }
  get managerBasePath(): string {
    return this.cfg.storage.managerBasePath;
  }

  get maxUploadBytes(): number {
    return this.cfg.upload.maxUploadBytes;
  }
  get maxZipEntries(): number {
    return this.cfg.upload.maxZipEntries;
  }
  get maxUncompressedBytes(): number {
    return this.cfg.upload.maxUncompressedBytes;
  }

  get db() {
    return this.cfg.db;
  }
  get authEnabled(): boolean {
    return this.cfg.authEnabled;
  }
  get pageloopEndpoint(): string {
    return this.cfg.pageloopEndpoint;
  }
}
