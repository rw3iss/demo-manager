import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { ArchiveExtractor } from './archive-extractor.interface';
import { SystemUnzipExtractor } from './system-unzip.extractor';

/**
 * Storage layer: filesystem layout + archive extraction. Binds the
 * {@link ArchiveExtractor} seam to the system-`unzip` implementation; swap the
 * `useClass` here to change extraction strategy.
 */
@Module({
  providers: [
    StorageService,
    { provide: ArchiveExtractor, useClass: SystemUnzipExtractor },
  ],
  exports: [StorageService],
})
export class StorageModule {}
