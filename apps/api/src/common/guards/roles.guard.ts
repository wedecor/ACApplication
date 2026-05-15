import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type Permission, type UserRole } from '@ac/types';
import { hasAllPermissions, outranks } from '@ac/auth';
import type { AuthPrincipal } from '@ac/auth';
import type { FastifyRequest } from 'fastify';

import { ALLOW_AUTHENTICATED_KEY, IS_PUBLIC_KEY, PERMS_KEY, ROLES_KEY } from '../decorators';

/**
 * Authorizes requests against:
 *   - `@Roles(...)`: any of the listed roles outranks the requirement, OR
 *   - `@RequirePermissions(...)`: caller holds ALL listed permissions.
 *
 * Both decorators are AND-ed when used together.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const allowAuthenticated = this.reflector.getAllAndOverride<boolean>(ALLOW_AUTHENTICATED_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    const perms = this.reflector.getAllAndOverride<Permission[] | undefined>(PERMS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    const req = ctx.switchToHttp().getRequest<FastifyRequest & { user?: AuthPrincipal }>();
    const user = req.user;
    if (!user) throw new ForbiddenException('Authentication required');

    if (allowAuthenticated && !roles?.length && !perms?.length) {
      return true;
    }

    if (!roles?.length && !perms?.length) {
      throw new ForbiddenException('Insufficient permissions');
    }

    if (roles?.length) {
      const ok = roles.some((r) => outranks(user.roles, r));
      if (!ok) throw new ForbiddenException(`Requires one of: ${roles.join(', ')}`);
    }

    if (perms?.length) {
      const ok = hasAllPermissions(perms, { roles: user.roles, permissions: user.permissions });
      if (!ok) throw new ForbiddenException(`Requires permissions: ${perms.join(', ')}`);
    }

    return true;
  }
}
