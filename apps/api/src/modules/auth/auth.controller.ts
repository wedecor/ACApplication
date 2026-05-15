import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { LoadedServerEnv } from '@ac/config';
import type { AuthPrincipal } from '@ac/auth';

import { IdempotencyKeys } from '@ac/notifications';
import { NotificationChannel } from '@ac/types';

import { APP_CONFIG } from '../../common/config/config.module';
import { AllowAuthenticated, CurrentUser, Public } from '../../common/decorators';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthService } from './auth.service';
import { RefreshSessionDto } from './dto/refresh-session.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

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
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
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
            idempotencyKey: IdempotencyKeys.otp(dto.destination, dto.purpose ?? 'LOGIN'),
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
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Verify an OTP and issue access + refresh tokens.' })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtpAndIssueTokens(dto.destination, dto.code);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Exchange a refresh token for a new access token.' })
  refresh(@Body() dto: RefreshSessionDto) {
    return this.auth.refreshWithOpaqueToken(dto.refreshToken);
  }

  @AllowAuthenticated()
  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@CurrentUser() _user: AuthPrincipal): void {
    // Session revocation wired in a later phase.
  }
}

function maskDestination(d: string): string {
  if (d.includes('@')) {
    const [user, domain] = d.split('@');
    return `${user?.slice(0, 2) ?? ''}***@${domain ?? ''}`;
  }
  return `${d.slice(0, 3)}******${d.slice(-2)}`;
}
