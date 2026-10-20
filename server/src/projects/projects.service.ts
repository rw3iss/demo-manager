import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../entities/project.entity';
import { AppConfigService } from '../config/app-config.service';
import { StorageService } from '../storage/storage.service';
import { AppError } from '../common/errors/app-error';
import { isValidSlug, slugify } from '../common/util/slug';
import { isReservedSlug } from '../common/util/reserved-slugs';
import { parseProjectSettings } from '../entities/project-settings';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectView, toProjectView } from './views';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    private readonly storage: StorageService,
    private readonly config: AppConfigService,
  ) {}

  private get baseUrl(): string {
    return this.config.publicBaseUrl;
  }

  async list(): Promise<ProjectView[]> {
    const projects = await this.projects.find({
      relations: { versions: true },
      order: { createdAt: 'DESC' },
    });
    return projects.map((p) => toProjectView(p, p.versions ?? [], this.baseUrl));
  }

  async detail(slug: string): Promise<ProjectView> {
    const project = await this.loadOrThrow(slug);
    return toProjectView(project, project.versions ?? [], this.baseUrl);
  }

  async create(dto: CreateProjectDto): Promise<ProjectView> {
    const name = dto.name.trim();
    const slug = (dto.slug?.trim() || slugify(name)).toLowerCase();

    if (!isValidSlug(slug)) {
      throw AppError.validation(
        `"${slug}" is not a valid slug. Use lowercase letters, numbers and hyphens.`,
        { slug },
      );
    }
    if (isReservedSlug(slug)) {
      throw AppError.conflict(`"${slug}" is a reserved name and can't be used as a slug.`, { slug });
    }
    if (await this.projects.findOne({ where: { slug } })) {
      throw AppError.conflict(`A project with slug "${slug}" already exists.`, { slug });
    }

    const project = this.projects.create({
      name,
      slug,
      description: dto.description?.trim() || null,
      enabled: true,
      currentVersionId: null,
      settings: parseProjectSettings({
        comments: { enabled: !!dto.commentsEnabled, pageloopProjectId: dto.pageloopProjectId },
      }),
    });
    await this.projects.save(project);
    await this.storage.ensureProjectDir(slug);

    this.logger.log(`Created project "${slug}"`);
    return toProjectView(project, [], this.baseUrl);
  }

  async update(slug: string, dto: UpdateProjectDto): Promise<ProjectView> {
    const project = await this.loadOrThrow(slug);
    const prevComments = parseProjectSettings(project.settings).comments;

    // Slug change → validate, ensure free, and rename the on-disk project dir.
    if (dto.slug !== undefined) {
      const newSlug = dto.slug.trim().toLowerCase();
      if (newSlug !== project.slug) {
        if (!isValidSlug(newSlug)) {
          throw AppError.validation(
            `"${newSlug}" is not a valid slug. Use lowercase letters, numbers and hyphens.`,
            { slug: newSlug },
          );
        }
        if (isReservedSlug(newSlug)) {
          throw AppError.conflict(`"${newSlug}" is a reserved name and can't be used as a slug.`, { slug: newSlug });
        }
        if (await this.projects.findOne({ where: { slug: newSlug } })) {
          throw AppError.conflict(`A project with slug "${newSlug}" already exists.`, { slug: newSlug });
        }
        await this.storage.renameProject(project.slug, newSlug);
        this.logger.log(`Renamed project "${project.slug}" → "${newSlug}"`);
        project.slug = newSlug;
      }
    }

    if (dto.name !== undefined) project.name = dto.name.trim();
    if (dto.description !== undefined) project.description = dto.description?.trim() || null;
    if (dto.enabled !== undefined) project.enabled = dto.enabled;
    if (dto.commentsEnabled !== undefined) {
      project.settings = parseProjectSettings({
        ...parseProjectSettings(project.settings),
        comments: { enabled: dto.commentsEnabled, pageloopProjectId: dto.pageloopProjectId },
      });
    }

    await this.projects.save(project);
    await this.applyCommentsTransition(project.slug, prevComments, parseProjectSettings(project.settings).comments);
    return toProjectView(project, project.versions ?? [], this.baseUrl);
  }

  /**
   * Retro-apply a comments setting change across all already-published versions.
   * Enabling (or changing the PageLoop id) re-injects the widget into every
   * version; disabling strips it. Best-effort: future publishes always honor the
   * stored setting, so a failure here is logged rather than failing the request.
   */
  private async applyCommentsTransition(
    slug: string,
    prev: { enabled: boolean; pageloopProjectId: string | null },
    next: { enabled: boolean; pageloopProjectId: string | null },
  ): Promise<void> {
    const turnedOnOrChanged =
      next.enabled && !!next.pageloopProjectId && (!prev.enabled || prev.pageloopProjectId !== next.pageloopProjectId);
    const turnedOff = !next.enabled && prev.enabled;

    try {
      if (turnedOnOrChanged) {
        await this.storage.reinjectProjectVersions(slug, {
          endpoint: this.config.pageloopEndpoint,
          projectId: next.pageloopProjectId!,
        });
        this.logger.log(`Re-injected PageLoop into all versions of "${slug}"`);
      } else if (turnedOff) {
        await this.storage.uninjectProjectVersions(slug);
        this.logger.log(`Removed PageLoop from all versions of "${slug}"`);
      }
    } catch (err) {
      this.logger.warn(`Comments retro-apply for "${slug}" failed: ${(err as Error).message}`);
    }
  }

  async remove(slug: string): Promise<void> {
    const project = await this.loadOrThrow(slug);
    await this.projects.remove(project); // versions cascade via FK ON DELETE CASCADE
    await this.storage.removeProject(slug).catch((err) => {
      this.logger.warn(`Project "${slug}" row deleted but files lingered: ${(err as Error).message}`);
    });
    this.logger.log(`Deleted project "${slug}"`);
  }

  private async loadOrThrow(slug: string): Promise<Project> {
    const project = await this.projects.findOne({
      where: { slug },
      relations: { versions: true },
    });
    if (!project) throw AppError.notFound(`No project found with slug "${slug}".`, { slug });
    return project;
  }
}
