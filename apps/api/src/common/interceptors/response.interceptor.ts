import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { type Observable, map } from 'rxjs';
import type { FastifyRequest } from 'fastify';

/**
 * Wraps successful controller responses in the canonical `ApiSuccess`
 * envelope, unless the controller has already returned one (detected via
 * the `success` discriminator).
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    return next.handle().pipe(
      map((data: unknown) => {
        if (data && typeof data === 'object' && 'success' in (data as Record<string, unknown>)) {
          return data;
        }
        return {
          success: true,
          data,
          requestId: req.id ?? 'unknown',
        };
      }),
    );
  }
}
