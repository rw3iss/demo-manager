import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../entities/project.entity';
import { Version } from '../entities/version.entity';
import { StorageModule } from '../storage/storage.module';
import { AppConfigService } from '../config/app-config.service';
import { VersionsController } from './versions.controller';
import { VersionsService } from './versions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, Version]),
    StorageModule,
    // Multer streams the upload to a temp file; size limit comes from config.
    MulterModule.registerAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => {
        const dest = join(tmpdir(), 'demo-manager-uploads');
        mkdirSync(dest, { recursive: true });
        return { dest, limits: { fileSize: config.maxUploadBytes } };
      },
    }),
  ],
  controllers: [VersionsController],
  providers: [VersionsService],
})
export class VersionsModule {}
