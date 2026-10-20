import { HttpStatus } from '@nestjs/common';

/** Stable, client-facing error codes. The UI maps these to friendly copy. */
export type AppErrorCode =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'BAD_ARCHIVE'
  | 'NO_INDEX_HTML'
  | 'INTERNAL';

const STATUS_BY_CODE: Record<AppErrorCode, number> = {
  VALIDATION: HttpStatus.BAD_REQUEST,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  CONFLICT: HttpStatus.CONFLICT,
  PAYLOAD_TOO_LARGE: HttpStatus.PAYLOAD_TOO_LARGE,
  BAD_ARCHIVE: HttpStatus.UNPROCESSABLE_ENTITY,
  NO_INDEX_HTML: HttpStatus.UNPROCESSABLE_ENTITY,
  INTERNAL: HttpStatus.INTERNAL_SERVER_ERROR,
};

/**
 * Domain error carrying a stable code + optional structured details. Thrown by
 * services; the {@link AllExceptionsFilter} renders it as the error envelope.
 * Using one error type keeps controllers/services free of HTTP concerns.
 */
export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(code: AppErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }

  static notFound(message: string, details?: Record<string, unknown>): AppError {
    return new AppError('NOT_FOUND', message, details);
  }
  static conflict(message: string, details?: Record<string, unknown>): AppError {
    return new AppError('CONFLICT', message, details);
  }
  static validation(message: string, details?: Record<string, unknown>): AppError {
    return new AppError('VALIDATION', message, details);
  }
  static badArchive(message: string, details?: Record<string, unknown>): AppError {
    return new AppError('BAD_ARCHIVE', message, details);
  }
  static noIndexHtml(message: string, details?: Record<string, unknown>): AppError {
    return new AppError('NO_INDEX_HTML', message, details);
  }
  static tooLarge(message: string, details?: Record<string, unknown>): AppError {
    return new AppError('PAYLOAD_TOO_LARGE', message, details);
  }
}
