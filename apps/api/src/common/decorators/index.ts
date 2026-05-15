import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Permission, UserRole } from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';
import type { FastifyRequest } from 'fastify';

export const IS_PUBLIC_KEY = 'isPublic';
export const ALLOW_AUTHENTICATED_KEY = 'allowAuthenticated';
export const ROLES_KEY = 'roles';
export const PERMS_KEY = 'permissions';

/** Mark a route as not requiring auth. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * JWT required but no specific permission (self-service profile, device tokens).
 * Explicit opt-in for deny-by-default RBAC.
 */
export const AllowAuthenticated = () => SetMetadata(ALLOW_AUTHENTICATED_KEY, true);

/** Restrict a route to a set of roles. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/** Restrict a route to callers holding ALL of the given permissions. */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMS_KEY, permissions);

/** Resolve the current authenticated principal from the request. */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthPrincipal | undefined => {
    const req = ctx.switchToHttp().getRequest<FastifyRequest & { user?: AuthPrincipal }>();
    return req.user;
  },
);
