import type { Permission, UserRole } from '@ac/types';

/**
 * Authenticated principal attached to every request after auth middleware.
 * Apps should depend on this contract, not on Prisma's `User` model.
 */
export interface AuthPrincipal {
  userId: string;
  tenantId: string;
  email: string | null;
  phone: string | null;
  roles: UserRole[];
  permissions: Permission[];
  sessionId: string;
  /** Tenant RBAC revision — must match JWT `pv` and DB `tenants.rbacVersion`. */
  permissionVersion: number;
  /** Issued-at unix seconds. */
  iat: number;
  /** Expires-at unix seconds. */
  exp: number;
}

export interface AccessTokenPayload {
  sub: string; // userId
  tid: string; // tenantId
  sid: string; // sessionId
  roles: UserRole[];
  permissions: Permission[];
  /** Permission revision (tenant.rbacVersion at issue time). */
  pv: number;
  /** Token type discriminator. */
  typ: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  tid: string;
  sid: string;
  /** Random opaque id stored hashed in DB to enable rotation/revocation. */
  jti: string;
  typ: 'refresh';
}

export type AnyTokenPayload = AccessTokenPayload | RefreshTokenPayload;

/** Token pair returned by `issueTokens`. */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}
