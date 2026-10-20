import type { Project } from '../entities/project.entity';
import type { Version } from '../entities/version.entity';
import { type ProjectSettings, parseProjectSettings } from '../entities/project-settings';

/** Serialized version as returned by the API. */
export interface VersionView {
  id: string;
  number: number;
  name: string | null;
  enabled: boolean;
  sizeBytes: number;
  fileCount: number;
  isCurrent: boolean;
  publicPath: string; // e.g. "/acme/3/"
  createdAt: number;
  updatedAt: number;
}

/** Serialized project (always includes its versions, newest first). */
export interface ProjectView {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  enabled: boolean;
  currentVersionNumber: number | null;
  versionCount: number;
  publicUrl: string; // absolute, e.g. "https://demos.ryanweiss.net/acme/"
  settings: ProjectSettings;
  createdAt: number;
  updatedAt: number;
  versions: VersionView[];
}

export function toVersionView(version: Version, slug: string, isCurrent: boolean): VersionView {
  return {
    id: version.id,
    number: version.number,
    name: version.name,
    enabled: version.enabled,
    sizeBytes: version.sizeBytes,
    fileCount: version.fileCount,
    isCurrent,
    publicPath: `/${slug}/${version.number}/`,
    createdAt: version.createdAt,
    updatedAt: version.updatedAt,
  };
}

/**
 * Build the full project view. `versions` are sorted newest-first; the version
 * whose id matches `currentVersionId` is flagged current.
 */
export function toProjectView(project: Project, versions: Version[], baseUrl: string): ProjectView {
  const sorted = [...versions].sort((a, b) => b.number - a.number);
  const current = sorted.find((v) => v.id === project.currentVersionId) ?? null;
  return {
    id: project.id,
    slug: project.slug,
    name: project.name,
    description: project.description,
    enabled: project.enabled,
    currentVersionNumber: current?.number ?? null,
    versionCount: sorted.length,
    publicUrl: `${baseUrl}/${project.slug}/`,
    settings: parseProjectSettings(project.settings),
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    versions: sorted.map((v) => toVersionView(v, project.slug, v.id === project.currentVersionId)),
  };
}
