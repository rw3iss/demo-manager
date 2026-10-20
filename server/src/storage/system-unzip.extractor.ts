import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Injectable, Logger } from '@nestjs/common';
import { AppError } from '../common/errors/app-error';
import { ArchiveExtractor, type ArchiveLimits } from './archive-extractor.interface';

const exec = promisify(execFile);
// Generous buffer for the file listing of large archives (names + sizes).
const LIST_MAX_BUFFER = 32 * 1024 * 1024;

interface ZipEntry {
  size: number;
  name: string;
}

/**
 * {@link ArchiveExtractor} backed by the system `unzip` binary (present on the
 * host; no npm zip dependency — honors the "prefer native/system" guidance).
 *
 * Two phases: (1) read the listing (`unzip -l`) to enforce limits and reject
 * unsafe paths *before* writing anything; (2) extract with `unzip -o`. We use
 * execFile with an argv array (never a shell string) so a crafted filename
 * can't inject a command.
 */
@Injectable()
export class SystemUnzipExtractor extends ArchiveExtractor {
  private readonly logger = new Logger(SystemUnzipExtractor.name);

  async extract(zipPath: string, destDir: string, limits: ArchiveLimits): Promise<void> {
    const entries = await this.list(zipPath);

    if (entries.length > limits.maxEntries) {
      throw AppError.tooLarge(
        `Archive has ${entries.length} entries (limit ${limits.maxEntries}).`,
      );
    }
    const total = entries.reduce((sum, e) => sum + e.size, 0);
    if (total > limits.maxUncompressedBytes) {
      throw AppError.tooLarge(
        `Archive expands to ${total} bytes (limit ${limits.maxUncompressedBytes}).`,
      );
    }
    for (const { name } of entries) {
      if (this.isUnsafePath(name)) {
        throw AppError.badArchive(`Archive contains an unsafe path entry: "${name}".`);
      }
    }

    try {
      await exec('unzip', ['-o', '-qq', zipPath, '-d', destDir], { maxBuffer: LIST_MAX_BUFFER });
    } catch (err) {
      this.logger.error(`unzip extraction failed: ${(err as Error).message}`);
      throw AppError.badArchive('Could not extract the uploaded archive — is it a valid .zip?');
    }
  }

  /** Parse `unzip -l` into entries. Throws BAD_ARCHIVE if the archive is unreadable. */
  private async list(zipPath: string): Promise<ZipEntry[]> {
    let stdout: string;
    try {
      ({ stdout } = await exec('unzip', ['-l', zipPath], { maxBuffer: LIST_MAX_BUFFER }));
    } catch (err) {
      this.logger.warn(`unzip -l failed: ${(err as Error).message}`);
      throw AppError.badArchive('The uploaded file is not a readable .zip archive.');
    }

    const entries: ZipEntry[] = [];
    // Entry rows look like: "    1234  2024-01-01 00:00   path/to/file".
    // Leading size, then date + time tokens, then the (possibly spaced) name.
    const row = /^\s*(\d+)\s+\S+\s+\S+\s+(.+?)\s*$/;
    for (const line of stdout.split('\n')) {
      const m = row.exec(line);
      if (!m) continue; // header, separators, and the summary line don't match
      const name = m[2];
      if (name.endsWith('/')) continue; // directory entry — not a file
      entries.push({ size: Number(m[1]), name });
    }
    return entries;
  }

  /** Reject absolute paths (posix or windows) and any `..` traversal segment. */
  private isUnsafePath(name: string): boolean {
    if (name.startsWith('/') || name.startsWith('\\')) return true;
    if (/^[A-Za-z]:[\\/]/.test(name)) return true; // C:\...
    return name
      .split(/[\\/]/)
      .some((seg) => seg === '..');
  }
}
