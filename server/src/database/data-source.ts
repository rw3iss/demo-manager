import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { buildTypeOrmOptions } from './typeorm-options';

// The migration CLI runs outside Nest, so load env files ourselves. (At app
// runtime, ConfigModule loads them and TypeOrmModule builds options instead.)
dotenv.config({ path: `.env.${process.env.NODE_ENV ?? 'development'}` });
dotenv.config({ path: '.env.local' });
dotenv.config();

export default new DataSource(
  buildTypeOrmOptions({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? '',
    name: process.env.DB_NAME ?? 'demo_manager',
    synchronize: false,
    runMigrations: false,
  }),
);
