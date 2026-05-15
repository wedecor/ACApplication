import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { NotificationsModule } from '../notifications/notifications.module';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { PermissionsLoader } from './permissions.loader';
import { TokenService } from './token.service';

/**
 * Authentication module. Foundation only — controllers wired with stub
 * handlers to define the public contract. Actual logic (login, OTP issue,
 * password reset, social) is implemented in the next phase.
 */
@Module({
  imports: [NotificationsModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    OtpService,
    PermissionsLoader,
    // Global JWT guard — every route is authenticated by default; opt-out
    // explicitly with @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService, TokenService, OtpService, PermissionsLoader],
})
export class AuthModule {}
