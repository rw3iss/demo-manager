import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';
import { Project } from '../entities/project.entity';
import { Version } from '../entities/version.entity';

export interface DbParams {
  host: string;
  port: number;
  user: string;
  password: string;
  name: string;
  synchronize: boolean;
  runMigrations: boolean;
}

/**
 * Single source of truth for TypeORM connection options, shared by the Nest
 * app (forRootAsync) and the migration CLI (data-source.ts). Entities are
 * referenced by class (robust under both ts-node and compiled dist); the
 * migrations glob matches `.ts` in dev and `.js` in prod.
 */
export function buildTypeOrmOptions(db: DbParams): DataSourceOptions {
  return {
    type: 'postgres',
    host: db.host,
    port: db.port,
    username: db.user,
    password: db.password,
    database: db.name,
    entities: [Project, Version],
    migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
    synchronize: db.synchronize,
    migrationsRun: db.runMigrations,
    logging: ['error', 'warn'],
  };
}
