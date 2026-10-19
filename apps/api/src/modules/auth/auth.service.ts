import { session } from '@ac/auth';
import type { LoadedServerEnv } from '@ac/config';
import type { Permission, RoleKey } from '@ac/types';
import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { SessionDevice, UserStatus } from '@prisma/client';

import { APP_CONFIG } from '../../common/config/config.module';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';

export interface AuthTokensResponse {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  /** Tenant RBAC revision embedded in the access JWT (`pv` claim). */
  permissionVersion: number;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    email: string | null;
    roles: RoleKey[];
  };
}

/**
 * Auth orchestrator — OTP verification, session persistence, JWT issuance.
 */
/** Old refresh tokens are tolerated this long after rotation (concurrent refreshes). */
const REFRESH_REUSE_GRACE_MS = 30_000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    readonly tokens: TokenService,
    readonly otp: OtpService,
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly env: LoadedServerEnv,
  ) {}

  async verifyOtpAndIssueTokens(
    destination: string,
    code: string,
    device: SessionDevice = SessionDevice.ADMIN_WEB,
    deviceId?: string,
  ): Promise<AuthTokensResponse> {
    const ok = await this.otp.verify(destination, code);
    if (!ok) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    const user = await this.prisma.client.user.findFirst({
      where: {
        OR: [{ phone: destination }, { email: destination }],
        deletedAt: null,
        status: UserStatus.ACTIVE,
      },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException(
        'No active staff account for this phone. Run database seed or contact an admin.',
      );
    }

    return this.issueSessionForUser(user, device, undefined, deviceId);
  }

  /**
   * Rotate the opaque refresh token and issue a fresh access JWT.
   * Used by the admin CRM when the 15-minute access token expires.
   */
  async refreshWithOpaqueToken(refreshOpaque: string): Promise<AuthTokensResponse> {
    const refreshHash = session.hashRefresh(refreshOpaque);
    const now = new Date();

    const dbSession = await this.prisma.client.session.findFirst({
      where: {
        refreshTokenHash: refreshHash,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      include: {
        user: {
          include: {
            roles: {
              include: {
                role: {
                  include: {
                    permissions: { include: { permission: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!dbSession) {
      await this.handleRefreshReuse(refreshHash, now);
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    if (!dbSession.user || dbSession.user.deletedAt || dbSession.user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const nextOpaque = session.newId();
    const nextHash = session.hashRefresh(nextOpaque);

    // Compare-and-swap: only the request still holding the current token rotates it.
    const rotated = await this.prisma.client.session.updateMany({
      where: { id: dbSession.id, refreshTokenHash: refreshHash, revokedAt: null },
      data: {
        refreshTokenHash: nextHash,
        previousRefreshTokenHash: refreshHash,
        refreshRotatedAt: now,
        lastUsedAt: now,
      },
    });
    if (rotated.count !== 1) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    return this.issueSessionForUser(dbSession.user, dbSession.device, {
      sessionId: dbSession.id,
      refreshOpaque: nextOpaque,
    });
  }

  /**
   * A refresh token that was already rotated is being presented again. Within a
   * short grace window that is a benign race (two tabs refreshing together);
   * after it, the old token has leaked — revoke the whole session.
   */
  private async handleRefreshReuse(refreshHash: string, now: Date): Promise<void> {
    const reused = await this.prisma.client.session.findFirst({
      where: { previousRefreshTokenHash: refreshHash, revokedAt: null },
      select: { id: true, userId: true, refreshRotatedAt: true },
    });
    if (!reused) return;
    const rotatedAgoMs = reused.refreshRotatedAt ? now.getTime() - reused.refreshRotatedAt.getTime() : Infinity;
    if (rotatedAgoMs <= REFRESH_REUSE_GRACE_MS) return;
    await this.prisma.client.session.updateMany({
      where: { id: reused.id, revokedAt: null },
      data: { revokedAt: now },
    });
    this.logger.warn({ sessionId: reused.id, userId: reused.userId }, 'Refresh token reuse detected — session revoked');
  }

  /**
   * Revoke sessions of a user — one (`sessionId`) or all of them. Revoked
   * sessions can no longer refresh; access JWTs expire on their short TTL.
   */
  async revokeSessions(userId: string, sessionId?: string): Promise<number> {
    const res = await this.prisma.client.session.updateMany({
      where: { userId, revokedAt: null, ...(sessionId ? { id: sessionId } : {}) },
      data: { revokedAt: new Date() },
    });
    return res.count;
  }

  /** Logs OTP to the API console when SMS is not configured (local dev). */
  logDevOtp(destination: string, code: string): void {
    this.logger.warn(`[DEV] OTP for ${destination}: ${code}`);
  }

  private async issueSessionForUser(
    user: {
      id: string;
      tenantId: string;
      firstName: string | null;
      lastName: string | null;
      phone: string | null;
      email: string | null;
      roles: {
        role: {
          key: string;
          permissions: { permission: { key: string } }[];
        };
      }[];
    },
    device: SessionDevice,
    existing?: { sessionId: string; refreshOpaque: string },
    deviceId?: string,
  ): Promise<AuthTokensResponse> {
    const roles = user.roles.map((a) => a.role.key);
    const permissionSet = new Set<Permission>();
    for (const assignment of user.roles) {
      for (const rp of assignment.role.permissions) {
        permissionSet.add(rp.permission.key as Permission);
      }
    }
    const permissions = [...permissionSet];

    const tenant = await this.prisma.client.tenant.findUniqueOrThrow({
      where: { id: user.tenantId },
      select: { rbacVersion: true },
    });

    const refreshOpaque = existing?.refreshOpaque ?? session.newId();
    const refreshHash = session.hashRefresh(refreshOpaque);
    const refreshTtlMs = parseDurationMs(this.env.JWT_REFRESH_TTL);

    const dbSession = existing
      ? { id: existing.sessionId }
      : await this.prisma.client.session.create({
          data: {
            userId: user.id,
            refreshTokenHash: refreshHash,
            device,
            deviceId: deviceId ?? null,
            expiresAt: new Date(Date.now() + refreshTtlMs),
          },
        });

    const pair = await this.tokens.issueTokens(
      {
        sub: user.id,
        tid: user.tenantId,
        sid: dbSession.id,
        roles,
        permissions,
        pv: tenant.rbacVersion,
      },
      refreshOpaque,
    );

    await this.prisma.client.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      accessToken: pair.accessToken,
      refreshToken: refreshOpaque,
      accessTokenExpiresAt: pair.accessTokenExpiresAt.toISOString(),
      refreshTokenExpiresAt: pair.refreshTokenExpiresAt.toISOString(),
      permissionVersion: tenant.rbacVersion,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        email: user.email,
        roles,
      },
    };
  }
}

function parseDurationMs(ttl: string): number {
  const match = /^(\d+)\s*([smhd])$/i.exec(ttl.trim());
  if (!match) return 30 * 24 * 60 * 60 * 1000;
  const amount = Number(match[1]);
  const unit = match[2]?.toLowerCase();
  const unitMs: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return amount * (unitMs[unit ?? 'd'] ?? 86_400_000);
}
