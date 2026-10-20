import { resolve } from 'node:path';

/**
 * Parse a comma-separated origins list. `*` (or empty) means "all".
 */
function parseOrigins(raw: string | undefined): string[] | '*' {
  const v = (raw ?? '*').trim();
  if (v === '' || v === '*') return '*';
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function bool(raw: string | undefined, fallback = false): boolean {
  if (raw === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

function num(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Typed, resolved configuration. Relative paths (DEMOS_ROOT, CLIENT_DIST_PATH)
 * are resolved to absolute against the process working directory at load time
 * so the rest of the app never has to think about cwd.
 */
export function configuration() {
  const env = process.env;
  const cwd = process.cwd();
  return {
    nodeEnv: env.NODE_ENV ?? 'development',
    isProd: env.NODE_ENV === 'production',
    port: num(env.PORT, 8092),
    host: env.HOST ?? '0.0.0.0',
    logLevel: env.LOG_LEVEL ?? 'log',
    corsOrigins: parseOrigins(env.CORS_ORIGINS),
    publicBaseUrl: (env.PUBLIC_BASE_URL ?? 'http://localhost:8092').replace(/\/$/, ''),

    storage: {
      demosRoot: resolve(cwd, env.DEMOS_ROOT ?? './.demos-data'),
      clientDistPath: resolve(cwd, env.CLIENT_DIST_PATH ?? '../client/dist'),
      managerBasePath: '/' + (env.MANAGER_BASE_PATH ?? '/manage').replace(/^\/+|\/+$/g, ''),
    },

    upload: {
      maxUploadBytes: num(env.MAX_UPLOAD_MB, 200) * 1024 * 1024,
      maxZipEntries: num(env.MAX_ZIP_ENTRIES, 5000),
      maxUncompressedBytes: num(env.MAX_UNCOMPRESSED_MB, 500) * 1024 * 1024,
    },

    // PageLoop endpoint used when injecting the comment widget into published demos.
    pageloopEndpoint: (env.PAGELOOP_ENDPOINT ?? 'https://pageloop.ryanweiss.net').replace(/\/$/, ''),

    db: {
      host: env.DB_HOST ?? '127.0.0.1',
      port: num(env.DB_PORT, 5432),
      user: env.DB_USER ?? 'postgres',
      password: env.DB_PASSWORD ?? '',
      name: env.DB_NAME ?? 'demo_manager',
      synchronize: bool(env.DB_SYNCHRONIZE, false),
      runMigrations: bool(env.DB_RUN_MIGRATIONS, false),
    },

    authEnabled: bool(env.AUTH_ENABLED, false),
  };
}

export type AppConfig = ReturnType<typeof configuration>;
