/**
 * Safety limits applied before/while extracting an uploaded archive — guards
 * against zip bombs (too many entries / too much uncompressed data).
 */
export interface ArchiveLimits {
  maxEntries: number;
  maxUncompressedBytes: number;
}

/**
 * Abstraction over "unzip this archive into that directory, safely".
 * Dependency-inversion seam: callers (StorageService) depend on this, not on
 * the system `unzip` binary or any particular library. Swap the bound provider
 * to change strategies without touching consumers.
 *
 * Implementations MUST reject entries with absolute paths or `..` segments
 * (path-traversal) and enforce the supplied {@link ArchiveLimits}, throwing an
 * {@link AppError} ('BAD_ARCHIVE' or 'PAYLOAD_TOO_LARGE') otherwise.
 */
export abstract class ArchiveExtractor {
  abstract extract(zipPath: string, destDir: string, limits: ArchiveLimits): Promise<void>;
}
