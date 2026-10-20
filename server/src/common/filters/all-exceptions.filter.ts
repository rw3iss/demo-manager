import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { AppError, type AppErrorCode } from '../errors/app-error';
import type { ApiErrorBody } from '../dto/api-response';

/**
 * Single place that turns any thrown error into the standard error envelope.
 * Keeps controllers/services HTTP-agnostic: they throw {@link AppError} (or let
 * framework/db errors bubble) and this maps them to a stable code + status.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const { status, code, message, details } = this.normalize(exception);

    if (status >= 500) {
      this.logger.error(`${req.method} ${req.url} → ${status} ${code}: ${message}`, this.stack(exception));
    } else {
      this.logger.warn(`${req.method} ${req.url} → ${status} ${code}: ${message}`);
    }

    const body: ApiErrorBody = { success: false, error: { code, message, ...(details ? { details } : {}) } };
    res.status(status).json(body);
  }

  private normalize(exception: unknown): {
    status: number;
    code: AppErrorCode | string;
    message: string;
    details?: Record<string, unknown>;
  } {
    if (exception instanceof AppError) {
      return { status: exception.status, code: exception.code, message: exception.message, details: exception.details };
    }

    // Multer file-size limit.
    if (this.isMulterLimit(exception)) {
      return { status: HttpStatus.PAYLOAD_TOO_LARGE, code: 'PAYLOAD_TOO_LARGE', message: 'Uploaded file exceeds the size limit.' };
    }

    // Postgres unique-violation → conflict (e.g. duplicate slug).
    if (exception instanceof QueryFailedError && (exception as { code?: string }).code === '23505') {
      return { status: HttpStatus.CONFLICT, code: 'CONFLICT', message: 'A record with that identifier already exists.' };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const resp = exception.getResponse();
      const message =
        typeof resp === 'string'
          ? resp
          : ((resp as { message?: string | string[] }).message ?? exception.message);
      // class-validator throws BadRequest with a messages array.
      const flat = Array.isArray(message) ? message.join('; ') : message;
      const code = status === HttpStatus.NOT_FOUND ? 'NOT_FOUND' : status === HttpStatus.BAD_REQUEST ? 'VALIDATION' : 'INTERNAL';
      return { status, code, message: flat, details: Array.isArray(message) ? { errors: message } : undefined };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL',
      message: 'An unexpected error occurred.',
    };
  }

  private isMulterLimit(e: unknown): boolean {
    return typeof e === 'object' && e !== null && (e as { code?: string }).code === 'LIMIT_FILE_SIZE';
  }

  private stack(e: unknown): string | undefined {
    return e instanceof Error ? e.stack : undefined;
  }
}
