import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { AppError } from '../common/errors/app-error';
import {
  injectPageloopSnippet,
  uninjectPageloopSnippet,
  type PageloopInjectOptions,
} from '../common/util/pageloop-inject';
import { ArchiveExtractor } from './archive-extractor.interface';

export interface ImportResult {
  fileCount: number;
}

/**
 * Owns the on-disk layout for demos: `DEMOS_ROOT/<slug>/<number>/…`. The only
 * component that touches the demo filesystem — extraction, flattening, index
 * detection, traversal-safe path resolution, and removal all live here.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly extractor: ArchiveExtractor,
  ) {}

  get root(): string {
    return this.config.demosRoot;
  }

  projectDir(slug: string): string {
    return join(this.root, slug);
  }

  versionDir(slug: string, version: number): string {
    return join(this.root, slug, String(version));
  }

  indexPath(slug: string, version: number): string {
    return join(this.versionDir(slug, version), 'index.html');
  }

  async ensureRoot(): Promise<void> {
    await mkdir(this.root, { recursive: true });
  }

  async ensureProjectDir(slug: string): Promise<void> {
    await mkdir(this.projectDir(slug), { recursive: true });
  }

  /** Materialize an upload (zip or a single .html/.htm) into the version dir.
   *  Rolls back the dir on any failure. */
  async importVersion(
    slug: string,
    version: number,
    srcPath: string,
    originalName: string,
    inject?: PageloopInjectOptions,
  ): Promise<ImportResult> {
    const dest = this.versionDir(slug, version);
    await rm(dest, { recursive: true, force: true });
    await mkdir(dest, { recursive: true });

    try {
      const fileCount = await this.materialize(srcPath, originalName, dest, inject);
      return { fileCount };
    } catch (err) {
      await rm(dest, { recursive: true, force: true }).catch(() => undefined);
      throw err;
    }
  }

  /**
   * Replace an existing version's files in place. The new package is validated
   * in a staging dir FIRST, so a bad zip never harms the live version; only on
   * success do we swap directories (moving the old aside as a backup that is
   * restored if the swap itself fails).
   */
  async replaceVersion(
    slug: string,
    version: number,
    srcPath: string,
    originalName: string,
    inject?: PageloopInjectOptions,
  ): Promise<ImportResult> {
    const finalDir = this.versionDir(slug, version);
    this.assertInsideRoot(finalDir);
    const staging = `${finalDir}.staging-${randomUUID()}`;
    const backup = `${finalDir}.old-${randomUUID()}`;

    await rm(staging, { recursive: true, force: true });
    await mkdir(staging, { recursive: true });

    let fileCount: number;
    try {
      fileCount = await this.materialize(srcPath, originalName, staging, inject);
    } catch (err) {
      await rm(staging, { recursive: true, force: true }).catch(() => undefined);
      throw err;
    }

    const hadOld = await this.exists(finalDir);
    if (hadOld) await rename(finalDir, backup);
    try {
      await rename(staging, finalDir);
    } catch (err) {
      if (hadOld) await rename(backup, finalDir).catch(() => undefined); // restore on failure
      await rm(staging, { recursive: true, force: true }).catch(() => undefined);
      throw err;
    }
    await rm(backup, { recursive: true, force: true }).catch(() => undefined);
    return { fileCount };
  }

  /**
   * Materialize an upload into an existing dir. A single `.html`/`.htm` upload
   * is copied straight in as `index.html`; anything else is treated as a zip
   * (extract → flatten → require index.html). Returns the file count.
   */
  private async materialize(
    srcPath: string,
    originalName: string,
    destDir: string,
    inject?: PageloopInjectOptions,
  ): Promise<number> {
    let fileCount: number;
    if (/\.html?$/i.test(originalName)) {
      await copyFile(srcPath, join(destDir, 'index.html'));
      fileCount = 1;
    } else {
      await this.extractor.extract(srcPath, destDir, {
        maxEntries: this.config.maxZipEntries,
        maxUncompressedBytes: this.config.maxUncompressedBytes,
      });
      await this.flattenSingleWrapper(destDir);
      await this.ensureRootIndexHtml(destDir);
      fileCount = await this.countFiles(destDir);
    }
    // Comments enabled → bake the PageLoop widget into every HTML page.
    if (inject) await this.injectCommentsIntoDir(destDir, inject);
    return fileCount;
  }

  /** Walk a version dir and inject the PageLoop snippet into each .html/.htm file. */
  private async injectCommentsIntoDir(dir: string, opts: PageloopInjectOptions): Promise<void> {
    await this.eachHtml(dir, (html) => injectPageloopSnippet(html, opts));
  }

  /** Walk a version dir and remove the PageLoop snippet from each .html/.htm file. */
  private async uninjectCommentsIntoDir(dir: string): Promise<void> {
    await this.eachHtml(dir, (html) => uninjectPageloopSnippet(html));
  }

  /** Apply a transform to every .html/.htm file under `dir` (recursively). */
  private async eachHtml(dir: string, transform: (html: string) => string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        await this.eachHtml(full, transform);
      } else if (e.isFile() && /\.html?$/i.test(e.name)) {
        const html = await readFile(full, 'utf8');
        const next = transform(html);
        if (next !== html) await writeFile(full, next);
      }
    }
  }

  /** Numeric version subdirs under a project (excludes staging/.old temp dirs). */
  private async versionDirs(slug: string): Promise<string[]> {
    const root = this.projectDir(slug);
    if (!(await this.exists(root))) return [];
    const entries = await readdir(root, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory() && /^\d+$/.test(e.name)).map((e) => join(root, e.name));
  }

  /** Re-inject the PageLoop snippet across ALL of a project's versions (used when
   *  comments are newly enabled or the project id changes). Idempotent: each dir
   *  is uninjected first so a stale/old-id snippet is replaced cleanly. */
  async reinjectProjectVersions(slug: string, opts: PageloopInjectOptions): Promise<void> {
    for (const dir of await this.versionDirs(slug)) {
      await this.uninjectCommentsIntoDir(dir);
      await this.injectCommentsIntoDir(dir, opts);
    }
  }

  /** Remove the PageLoop snippet across ALL of a project's versions (comments off). */
  async uninjectProjectVersions(slug: string): Promise<void> {
    for (const dir of await this.versionDirs(slug)) {
      await this.uninjectCommentsIntoDir(dir);
    }
  }

  /** Rename a project's on-disk root (moves all version subdirs with it). */
  async renameProject(oldSlug: string, newSlug: string): Promise<void> {
    const from = this.projectDir(oldSlug);
    const to = this.projectDir(newSlug);
    this.assertInsideRoot(from);
    this.assertInsideRoot(to);
    if (!(await this.exists(from))) return; // no files yet (project never published)
    if (await this.exists(to)) {
      throw new Error(`Refusing to overwrite existing directory: ${to}`);
    }
    await rename(from, to);
  }

  async removeVersion(slug: string, version: number): Promise<void> {
    const dir = this.versionDir(slug, version);
    this.assertInsideRoot(dir);
    await rm(dir, { recursive: true, force: true });
  }

  async removeProject(slug: string): Promise<void> {
    const dir = this.projectDir(slug);
    this.assertInsideRoot(dir);
    await rm(dir, { recursive: true, force: true });
  }

  /**
   * Resolve a request asset path to an absolute file path, guaranteed to stay
   * within the version directory. Returns null on traversal attempts.
   */
  resolveAsset(slug: string, version: number, relPath: string): string | null {
    const base = this.versionDir(slug, version);
    const clean = relPath.replace(/^\/+/, '');
    const candidate = resolve(base, clean);
    return this.isInside(base, candidate) ? candidate : null;
  }

  // ── internals ───────────────────────────────────────────────────────────

  /** If the archive wrapped everything in a single top-level folder, lift its
   *  contents up so index.html lands at the version root. Ignores macOS junk. */
  private async flattenSingleWrapper(dest: string): Promise<void> {
    const junk = (name: string) => name === '__MACOSX' || name.startsWith('.');
    const entries = (await readdir(dest, { withFileTypes: true })).filter((e) => !junk(e.name));

    if (entries.some((e) => e.isFile() && e.name === 'index.html')) return;

    const dirs = entries.filter((e) => e.isDirectory());
    const files = entries.filter((e) => e.isFile());
    if (dirs.length === 1 && files.length === 0) {
      const inner = join(dest, dirs[0].name);
      for (const child of await readdir(inner)) {
        await rename(join(inner, child), join(dest, child));
      }
      await rm(inner, { recursive: true, force: true });
    }
    // Tidy macOS resource fork dir if present.
    await rm(join(dest, '__MACOSX'), { recursive: true, force: true }).catch(() => undefined);
  }

  /**
   * Guarantee an index.html at the version root. If it's missing, fall back to
   * a single root-level .html/.htm file and rename it to index.html. Zero, or
   * more than one, candidate is a user error.
   */
  private async ensureRootIndexHtml(dest: string): Promise<void> {
    if (await this.exists(join(dest, 'index.html'))) return;

    const entries = await readdir(dest, { withFileTypes: true });
    const htmlFiles = entries.filter((e) => e.isFile() && /\.html?$/i.test(e.name)).map((e) => e.name);

    if (htmlFiles.length === 1) {
      await rename(join(dest, htmlFiles[0]), join(dest, 'index.html'));
      return;
    }

    throw AppError.noIndexHtml(
      'No index.html file found in the package, or more than one html file was found in the root. Packages must include a single html or htm file in the root.',
    );
  }

  private async countFiles(dir: string): Promise<number> {
    let count = 0;
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory()) count += await this.countFiles(join(dir, e.name));
      else if (e.isFile()) count += 1;
    }
    return count;
  }

  private async exists(path: string): Promise<boolean> {
    try {
      await stat(path);
      return true;
    } catch {
      return false;
    }
  }

  private isInside(parent: string, child: string): boolean {
    const rel = relative(parent, child);
    return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
  }

  /** Defense-in-depth: never rm anything outside DEMOS_ROOT. */
  private assertInsideRoot(dir: string): void {
    if (!this.isInside(this.root, dir) || resolve(dir) === resolve(this.root)) {
      this.logger.error(`Refusing to remove path outside demos root: ${dir}`);
      throw new Error(`Refusing to operate outside demos root: ${dir}`);
    }
  }
}
