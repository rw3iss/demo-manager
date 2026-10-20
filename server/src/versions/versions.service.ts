import { unlink } from 'node:fs/promises';
import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Project } from '../entities/project.entity';
import { Version } from '../entities/version.entity';
import { AppConfigService } from '../config/app-config.service';
import { StorageService } from '../storage/storage.service';
import { AppError } from '../common/errors/app-error';
import { parseBoolFlag } from '../common/util/flags';
import { parseProjectSettings } from '../entities/project-settings';
import type { PageloopInjectOptions } from '../common/util/pageloop-inject';
import { ProjectView, toProjectView } from '../projects/views';
import { CreateVersionDto } from './dto/create-version.dto';
import { UpdateVersionDto } from './dto/update-version.dto';
import { ReplaceVersionDto } from './dto/replace-version.dto';

/**
 * Owns the version lifecycle: publish (zip upload → extract → row → optional
 * promote), promote, enable/disable, delete — plus the "current" invariant
 * (current always points at an enabled, existing version, or null).
 *
 * Operations return the full updated {@link ProjectView} so the client can
 * re-render the project in one round-trip.
 */
@Injectable()
export class VersionsService {
  private readonly logger = new Logger(VersionsService.name);

  constructor(
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(Version) private readonly versions: Repository<Version>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly storage: StorageService,
    private readonly config: AppConfigService,
  ) {}

  /** Publish a new version from an uploaded zip (temp path on disk). */
  async publish(
    slug: string,
    file: { path: string; size: number; originalname: string },
    dto: CreateVersionDto,
  ): Promise<ProjectView> {
    const project = await this.projectOrThrow(slug);
    const nextNumber = await this.nextVersionNumber(project.id);
    const promote = parseBoolFlag(dto.promote, true);
    const inject = this.commentsInject(project);

    try {
      const { fileCount } = await this.storage.importVersion(
        slug,
        nextNumber,
        file.path,
        file.originalname,
        inject,
      );

      try {
        await this.dataSource.transaction(async (mgr) => {
          const version = mgr.create(Version, {
            projectId: project.id,
            number: nextNumber,
            name: dto.name?.trim() || null,
            enabled: true,
            sizeBytes: file.size,
            fileCount,
          });
          await mgr.save(version);
          if (promote) {
            project.currentVersionId = version.id;
            await mgr.save(project);
          }
        });
      } catch (dbErr) {
        // Roll back the extracted files so disk and DB stay consistent.
        await this.storage.removeVersion(slug, nextNumber).catch(() => undefined);
        throw dbErr;
      }

      this.logger.log(`Published ${slug} v${nextNumber} (${fileCount} files, promote=${promote})`);
      return this.buildView(slug);
    } finally {
      await unlink(file.path).catch(() => undefined); // temp upload cleanup
    }
  }

  /**
   * Replace an existing version's files with a freshly-uploaded zip (same
   * validation as publish). Only the files + size/file-count/updatedAt change,
   * plus an optional promote-to-current. Everything else stays put.
   */
  async replace(
    slug: string,
    number: number,
    file: { path: string; size: number; originalname: string },
    dto: ReplaceVersionDto,
  ): Promise<ProjectView> {
    const project = await this.projectOrThrow(slug);
    const version = await this.versionOrThrow(project.id, number);
    const promote = parseBoolFlag(dto.promote, false);
    const inject = this.commentsInject(project);

    try {
      // Validates the new package and swaps it in atomically (live files are
      // untouched if the zip is invalid).
      const { fileCount } = await this.storage.replaceVersion(
        slug,
        number,
        file.path,
        file.originalname,
        inject,
      );

      await this.dataSource.transaction(async (mgr) => {
        version.sizeBytes = file.size;
        version.fileCount = fileCount; // @BeforeUpdate bumps updatedAt
        await mgr.save(version);
        if (promote && project.currentVersionId !== version.id) {
          project.currentVersionId = version.id;
          await mgr.save(project);
        }
      });

      this.logger.log(`Replaced ${slug} v${number} (${fileCount} files, promote=${promote})`);
      return this.buildView(slug);
    } finally {
      await unlink(file.path).catch(() => undefined); // temp upload cleanup
    }
  }

  async promote(slug: string, number: number): Promise<ProjectView> {
    const project = await this.projectOrThrow(slug);
    const version = await this.versionOrThrow(project.id, number);
    if (!version.enabled) {
      throw AppError.validation(
        `Version ${number} is disabled — enable it before making it current.`,
        { slug, number },
      );
    }
    project.currentVersionId = version.id;
    await this.projects.save(project);
    return this.buildView(slug);
  }

  async update(slug: string, number: number, dto: UpdateVersionDto): Promise<ProjectView> {
    const project = await this.projectOrThrow(slug);
    const version = await this.versionOrThrow(project.id, number);

    await this.dataSource.transaction(async (mgr) => {
      if (dto.name !== undefined) version.name = dto.name?.trim() || null;
      if (dto.enabled !== undefined) version.enabled = dto.enabled;
      await mgr.save(version);
      await this.ensureValidCurrent(project, mgr);
    });

    return this.buildView(slug);
  }

  async remove(slug: string, number: number): Promise<ProjectView> {
    const project = await this.projectOrThrow(slug);
    const version = await this.versionOrThrow(project.id, number);

    await this.dataSource.transaction(async (mgr) => {
      await mgr.remove(version);
      await this.ensureValidCurrent(project, mgr);
    });
    await this.storage.removeVersion(slug, number).catch((err) => {
      this.logger.warn(`Version ${slug} v${number} row deleted but files lingered: ${(err as Error).message}`);
    });

    this.logger.log(`Deleted ${slug} v${number}`);
    return this.buildView(slug);
  }

  // ── internals ───────────────────────────────────────────────────────────

  /**
   * Keep the "current" pointer valid: if it's unset, deleted, or now-disabled,
   * repoint to the latest enabled version (or null). Explicit current choices
   * that remain valid are preserved (current need not be the latest).
   */
  private async ensureValidCurrent(project: Project, mgr: EntityManager): Promise<void> {
    const versions = await mgr.find(Version, { where: { projectId: project.id } });
    const currentValid =
      !!project.currentVersionId &&
      versions.some((v) => v.id === project.currentVersionId && v.enabled);
    if (currentValid) return;

    const latestEnabled = versions
      .filter((v) => v.enabled)
      .sort((a, b) => b.number - a.number)[0];
    project.currentVersionId = latestEnabled?.id ?? null;
    await mgr.save(project);
  }

  /** PageLoop injection options for a project, or undefined when comments are off. */
  private commentsInject(project: Project): PageloopInjectOptions | undefined {
    const { comments } = parseProjectSettings(project.settings);
    if (comments.enabled && comments.pageloopProjectId) {
      return { endpoint: this.config.pageloopEndpoint, projectId: comments.pageloopProjectId };
    }
    return undefined;
  }

  private async nextVersionNumber(projectId: string): Promise<number> {
    const row = await this.versions
      .createQueryBuilder('v')
      .select('MAX(v.number)', 'max')
      .where('v.project_id = :projectId', { projectId })
      .getRawOne<{ max: string | null }>();
    return (row?.max ? Number(row.max) : 0) + 1;
  }

  private async projectOrThrow(slug: string): Promise<Project> {
    const project = await this.projects.findOne({ where: { slug } });
    if (!project) throw AppError.notFound(`No project found with slug "${slug}".`, { slug });
    return project;
  }

  private async versionOrThrow(projectId: string, number: number): Promise<Version> {
    const version = await this.versions.findOne({ where: { projectId, number } });
    if (!version) throw AppError.notFound(`No version ${number} for this project.`, { number });
    return version;
  }

  private async buildView(slug: string): Promise<ProjectView> {
    const project = await this.projects.findOne({ where: { slug }, relations: { versions: true } });
    if (!project) throw AppError.notFound(`No project found with slug "${slug}".`, { slug });
    return toProjectView(project, project.versions ?? [], this.config.publicBaseUrl);
  }
}
