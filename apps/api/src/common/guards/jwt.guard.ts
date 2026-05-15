import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthPrincipal } from '@ac/auth';
import type { FastifyRequest } from 'fastify';
import { ClsService } from 'nestjs-cls';

import { PermissionsStaleException } from '../exceptions/permissions-stale.exception';
import { IS_PUBLIC_KEY } from '../decorators';
import { PermissionsLoader } from '../../modules/auth/permissions.loader';
import { TokenService } from '../../modules/auth/token.service';
import { RbacService } from '../../modules/rbac/rbac.service';

/**
 * Validates the Bearer access token, attaches the decoded principal to the
 * request, seeds the CLS store with the actor (so the audit extension can
 * attribute writes), and respects @Public() to short-circuit anonymous
 * endpoints.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly permissions: PermissionsLoader,
    private readonly rbac: RbacService,
    private readonly cls: ClsService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<FastifyRequest & { user?: AuthPrincipal }>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Missing bearer token');

    try {
      const payload = await this.tokens.verifyAccess(header.slice('Bearer '.length));
      const tenantRbacVersion = await this.rbac.getTenantRbacVersion(payload.tid);
      const tokenPv = payload.pv ?? 0;
      if (tokenPv < tenantRbacVersion) {
        throw new PermissionsStaleException();
      }

      const fresh = await this.permissions.loadForUser(payload.sub);
      const principal: AuthPrincipal = {
        userId: payload.sub,
        tenantId: payload.tid,
        sessionId: payload.sid,
        roles: fresh.roles,
        permissions: fresh.permissions,
        email: null,
        phone: null,
        permissionVersion: tenantRbacVersion,
        iat: payload.iat,
        exp: payload.exp,
      };
      req.user = principal;
      this.cls.set('actor', { userId: principal.userId, tenantId: principal.tenantId });
      return true;
    } catch (err) {
      if (err instanceof PermissionsStaleException) throw err;
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
