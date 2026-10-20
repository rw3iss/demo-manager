import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * Liveness/readiness probe. Verifies DB connectivity so the deploy health-gate
 * (curl localhost:PORT/healthz) fails fast if the database is unreachable.
 */
@Controller('healthz')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  async check() {
    await this.dataSource.query('SELECT 1');
    return { status: 'ok', uptimeSec: Math.floor(process.uptime()) };
  }
}
