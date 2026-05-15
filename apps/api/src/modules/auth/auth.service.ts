import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { session } from '@ac/auth';
import type { LoadedServerEnv } from '@ac/config';
import type { Permission, UserRole } from '@ac/types';
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
    roles: UserRole[];
  };
}

/**
 * Auth orchestrator — OTP verification, session persistence, JWT issuance.
 */
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

    return this.issueSessionForUser(user, device);
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

    if (!dbSession?.user || dbSession.user.deletedAt || dbSession.user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const nextOpaque = session.newId();
    const nextHash = session.hashRefresh(nextOpaque);

    await this.prisma.client.session.update({
      where: { id: dbSession.id },
      data: {
        refreshTokenHash: nextHash,
        lastUsedAt: now,
      },
    });

    return this.issueSessionForUser(dbSession.user, dbSession.device, {
      sessionId: dbSession.id,
      refreshOpaque: nextOpaque,
    });
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
      roles: Array<{
        role: {
          key: string;
          permissions: Array<{ permission: { key: string } }>;
        };
      }>;
    },
    device: SessionDevice,
    existing?: { sessionId: string; refreshOpaque: string },
  ): Promise<AuthTokensResponse> {
    const roles = user.roles.map((a) => a.role.key as UserRole);
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
  const match = ttl.trim().match(/^(\d+)\s*([smhd])$/i);
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
