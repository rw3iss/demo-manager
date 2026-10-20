import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { ApiSuccess } from '../dto/api-response';

/**
 * Wraps every successful controller return value in the standard success
 * envelope `{ success: true, data }`. Static/demo serving bypasses Nest's
 * controller pipeline (it writes to the response directly), so it is unaffected.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiSuccess<T>> {
  intercept(_ctx: ExecutionContext, next: CallHandler<T>): Observable<ApiSuccess<T>> {
    return next.handle().pipe(map((data) => ({ success: true as const, data })));
  }
}
