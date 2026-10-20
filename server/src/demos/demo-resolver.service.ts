import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../entities/project.entity';
import { Version } from '../entities/version.entity';

export type Resolution =
  | {
      kind: 'serve';
      slug: string;
      versionNumber: number;
      assetRelPath: string; // '' means the version's index.html
      baseHref: string; // '/slug/' or '/slug/n/'
    }
  | { kind: 'redirect'; location: string } // 302 → the current version's canonical URL
  | { kind: 'not_found'; reason: string };

/**
 * Pure decision logic for a public demo request: map `(slug, restSegments)` to
 * the project, the effective version, the asset path, and the `<base href>`.
 * Only does DB reads — easy to reason about and test.
 *
 * Version selection: if the first remaining segment is a bare integer matching
 * an *enabled* version, that version is pinned (`/slug/<n>/…`); otherwise the
 * project's *current* version is used and the whole remainder is the asset path
 * (`/slug/…`). This keeps a demo's own routes (`/about`, `/items/5`) working.
 *
 * The bare project root (`/slug` or `/slug/`) is only a pointer to the current
 * version, so it resolves to a `redirect` to `/slug/<n>/` — giving each demo one
 * canonical URL (so the comment widget registers a single page per version, not
 * a duplicate for the root). Deeper non-pinned paths still serve in place.
 */
@Injectable()
export class DemoResolverService {
  constructor(
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(Version) private readonly versions: Repository<Version>,
  ) {}

  async resolve(slug: string, rest: string[]): Promise<Resolution> {
    const project = await this.projects.findOne({ where: { slug } });
    if (!project || !project.enabled) {
      return { kind: 'not_found', reason: `No demo published at /${slug}/.` };
    }

    const first = rest[0];
    if (first !== undefined && /^\d+$/.test(first)) {
      const pinned = await this.versions.findOne({
        where: { projectId: project.id, number: Number(first) },
      });
      if (pinned) {
        // A real version was pinned. If it's disabled it's explicitly hidden
        // (404) — we don't silently fall back to current. A numeric segment
        // that is NOT a real version falls through and is treated as a client
        // route of the current version (so a demo's own /2 route still works).
        if (!pinned.enabled) {
          return { kind: 'not_found', reason: `Version ${pinned.number} of "${project.name}" is not available.` };
        }
        return {
          kind: 'serve',
          slug,
          versionNumber: pinned.number,
          assetRelPath: rest.slice(1).join('/'),
          baseHref: `/${slug}/${pinned.number}/`,
        };
      }
    }

    // No version pinned → the current version.
    if (!project.currentVersionId) {
      return { kind: 'not_found', reason: `"${project.name}" has no current version yet.` };
    }
    const current = await this.versions.findOne({ where: { id: project.currentVersionId } });
    if (!current || !current.enabled) {
      return { kind: 'not_found', reason: `"${project.name}" has no published version available.` };
    }
    // The bare project root is a pointer to the current version: redirect to its
    // canonical `/slug/<n>/` URL instead of serving identical content at two URLs.
    if (rest.length === 0) {
      return { kind: 'redirect', location: `/${slug}/${current.number}/` };
    }
    // Deeper non-pinned paths still serve in place; the whole remainder is the asset path.
    return {
      kind: 'serve',
      slug,
      versionNumber: current.number,
      assetRelPath: rest.join('/'),
      baseHref: `/${slug}/`,
    };
  }
}
