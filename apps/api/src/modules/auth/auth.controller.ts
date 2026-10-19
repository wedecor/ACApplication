import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { LoadedServerEnv } from '@ac/config';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthPrincipal } from '@ac/auth';

import { IdempotencyKeys } from '@ac/notifications';
import { NotificationChannel } from '@ac/types';
import { SessionDevice } from '@prisma/client';

import { APP_CONFIG } from '../../common/config/config.module';
import { AllowAuthenticated, CurrentUser, Public } from '../../common/decorators';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthService } from './auth.service';
import { RefreshSessionDto } from './dto/refresh-session.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import {
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
  wantsCookieTransport,
  withoutRefreshToken,
} from './session-cookie';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @Inject(APP_CONFIG) private readonly env: LoadedServerEnv,
  ) {}

  @Public()
  @Post('otp/request')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ global: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Request an OTP for the given destination.' })
  async requestOtp(@Body() dto: RequestOtpDto) {
    const result = await this.auth.otp.issue(dto.destination, dto.purpose ?? 'LOGIN');

    if (this.env.NODE_ENV === 'development' || this.env.SMS_PROVIDER === 'console') {
      this.auth.logDevOtp(dto.destination, result.code);
    } else if (!dto.destination.includes('@')) {
      const user = await this.prisma.client.user.findFirst({
        where: {
          OR: [{ phone: dto.destination }, { email: dto.destination }],
          deletedAt: null,
        },
        select: { tenantId: true },
      });
      const fallback = user
        ? null
        : await this.prisma.client.tenant.findFirst({
            select: { id: true },
            orderBy: { createdAt: 'asc' },
          });
      const tenantId = user?.tenantId ?? fallback?.id;
      if (tenantId) {
        await this.notifications.enqueue(
          tenantId,
          { phone: dto.destination },
          [NotificationChannel.SMS],
          {
            template: 'auth.otp',
            data: { code: result.code },
            idempotencyKey: IdempotencyKeys.otp(dto.destination, dto.purpose ?? 'LOGIN', result.issueId),
          },
        );
      }
    }

    return {
      ttlSeconds: result.ttlSeconds,
      sentTo: maskDestination(dto.destination),
      ...(this.env.NODE_ENV === 'development' ? { devCode: result.code } : {}),
    };
  }

  @Public()
  @Post('otp/verify')
  @Throttle({ global: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Verify an OTP and issue access + refresh tokens.' })
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const tokens = await this.auth.verifyOtpAndIssueTokens(dto.destination, dto.code, dto.device ? sessionDeviceFor(dto.device.platform) : undefined, dto.device?.deviceId);
    if (!wantsCookieTransport(req)) return tokens;
    setRefreshCookie(reply, tokens.refreshToken, tokens.refreshTokenExpiresAt);
    return withoutRefreshToken(tokens);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ global: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Exchange a refresh token for a new access token.' })
  async refresh(
    @Body() dto: RefreshSessionDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const cookieMode = wantsCookieTransport(req);
    const presented = cookieMode ? readRefreshCookie(req) : dto.refreshToken;
    if (!presented) throw new UnauthorizedException('Invalid or expired refresh token');
    const tokens = await this.auth.refreshWithOpaqueToken(presented);
    if (!cookieMode) return tokens;
    setRefreshCookie(reply, tokens.refreshToken, tokens.refreshTokenExpiresAt);
    return withoutRefreshToken(tokens);
  }

  @AllowAuthenticated()
  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke the current session (refresh token stops working).' })
  async logout(
    @CurrentUser() user: AuthPrincipal,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    await this.auth.revokeSessions(user.userId, user.sessionId);
    clearRefreshCookie(reply);
  }

  @AllowAuthenticated()
  @ApiBearerAuth()
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke every session of the current user (sign out everywhere).' })
  async logoutAll(@CurrentUser() user: AuthPrincipal): Promise<{ ok: true; revoked: number }> {
    const revoked = await this.auth.revokeSessions(user.userId);
    return { ok: true, revoked };
  }
}

function sessionDeviceFor(platform?: string): SessionDevice {
  const p = (platform ?? '').toLowerCase();
  if (p === 'android') return SessionDevice.ANDROID;
  if (p === 'ios') return SessionDevice.IOS;
  return SessionDevice.CUSTOMER_APP;
}

function maskDestination(d: string): string {
  if (d.includes('@')) {
    const [user, domain] = d.split('@');
    return `${user?.slice(0, 2) ?? ''}***@${domain ?? ''}`;
  }
  return `${d.slice(0, 3)}******${d.slice(-2)}`;
}
