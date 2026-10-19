import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { map,type Observable } from 'rxjs';

/** Binary / streamed bodies and non-JSON responses must reach the client untouched. */
export function isRawResponse(data: unknown, reply?: Pick<FastifyReply, 'sent' | 'getHeader'>): boolean {
  if (Buffer.isBuffer(data) || data instanceof Uint8Array || data instanceof StreamableFile) return true;
  if (data && typeof (data as { pipe?: unknown }).pipe === 'function') return true;
  if (reply?.sent) return true;
  const contentType = reply?.getHeader('content-type');
  return Boolean(contentType && !String(contentType).includes('json'));
}

/**
 * Wraps successful controller responses in the canonical `ApiSuccess`
 * envelope, unless the controller has already returned one (detected via
 * the `success` discriminator) or is sending a raw body (PDF, CSV, stream).
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();
    return next.handle().pipe(
      map((data: unknown) => {
        if (isRawResponse(data, reply)) return data;
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
