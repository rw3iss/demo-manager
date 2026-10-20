import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from './config/config.module';
import { AppConfigService } from './config/app-config.service';
import { buildTypeOrmOptions } from './database/typeorm-options';
import { ProjectsModule } from './projects/projects.module';
import { VersionsModule } from './versions/versions.module';
import { PublicServingModule } from './demos/public-serving.module';
import { HealthModule } from './health/health.module';

/**
 * Composition root. Config + DB are wired first; feature modules
 * (projects, versions) and the public-serving layer follow.
 */
@Module({
  imports: [
    AppConfigModule,
    TypeOrmModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => buildTypeOrmOptions(config.db),
    }),
    ProjectsModule,
    VersionsModule,
    PublicServingModule,
    HealthModule,
  ],
})
export class AppModule {}
