import * as Joi from 'joi';

/**
 * Joi schema for process.env. Validation runs at boot (see AppModule); the app
 * refuses to start with an invalid/missing required variable rather than
 * failing mysteriously at runtime.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'staging', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(8092),
  HOST: Joi.string().default('0.0.0.0'),
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'log', 'debug', 'verbose')
    .default('log'),
  CORS_ORIGINS: Joi.string().allow('').default('*'),
  PUBLIC_BASE_URL: Joi.string().uri().default('http://localhost:8092'),

  DEMOS_ROOT: Joi.string().default('./.demos-data'),
  CLIENT_DIST_PATH: Joi.string().default('../client/dist'),
  MANAGER_BASE_PATH: Joi.string().default('/manage'),

  MAX_UPLOAD_MB: Joi.number().positive().default(200),
  MAX_ZIP_ENTRIES: Joi.number().positive().default(5000),
  MAX_UNCOMPRESSED_MB: Joi.number().positive().default(500),

  DB_HOST: Joi.string().default('127.0.0.1'),
  DB_PORT: Joi.number().port().default(5432),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().allow('').required(),
  DB_NAME: Joi.string().required(),
  DB_SYNCHRONIZE: Joi.boolean().default(false),
  DB_RUN_MIGRATIONS: Joi.boolean().default(false),

  AUTH_ENABLED: Joi.boolean().default(false),

  PAGELOOP_ENDPOINT: Joi.string().uri().default('https://pageloop.vendidit.com'),
});
