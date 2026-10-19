import { type ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

import { isTrustedProxyRequest } from '../security/internal-proxy';

/**
 * Global throttler that skips requests from the website's server-side proxy
 * (verified by its internal token). Behind the proxy every visitor shares the
 * proxy's IP, so per-IP limits would throttle all visitors together; the proxy
 * already rate-limits per real client.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override async shouldSkip(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return super.shouldSkip(context);
    const req = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    return isTrustedProxyRequest(req) || super.shouldSkip(context);
  }
}
