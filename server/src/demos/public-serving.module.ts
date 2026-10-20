import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../entities/project.entity';
import { Version } from '../entities/version.entity';
import { StorageModule } from '../storage/storage.module';
import { ManagerServingService } from '../manager/manager-serving.service';
import { DemoResolverService } from './demo-resolver.service';
import { DemoServingService } from './demo-serving.service';
import { StaticDispatcher } from './static-dispatcher.service';

/**
 * Public-facing static serving: the manager SPA, the demos, and the dispatcher
 * that routes between them. Provided here and pulled from the container in
 * main.ts to attach as the final Express handler.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Project, Version]), StorageModule],
  providers: [DemoResolverService, DemoServingService, ManagerServingService, StaticDispatcher],
  exports: [StaticDispatcher],
})
export class PublicServingModule {}
