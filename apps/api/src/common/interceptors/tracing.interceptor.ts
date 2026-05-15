import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ClsService } from 'nestjs-cls';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs';

/**
 * Propagates `x-request-id` to the response and seeds the request-scoped CLS
 * store so downstream services can attribute audit logs / metrics.
 */
@Injectable()
export class TracingInterceptor implements NestInterceptor {
  constructor(private readonly cls: ClsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<FastifyRequest>();
    const res = http.getResponse<FastifyReply>();

    const requestId = (req.id as string | undefined) ?? 'unknown';
    this.cls.set('requestId', requestId);

    void res.header('x-request-id', requestId);

    const started = Date.now();
    return next.handle().pipe(
      tap(() => {
        void res.header('x-response-time', `${Date.now() - started}ms`);
      }),
    );
  }
}
