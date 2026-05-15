import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import type { LoadedServerEnv } from '@ac/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Permission } from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { APP_CONFIG } from '../../common/config/config.module';
import { CurrentUser, Public, RequirePermissions } from '../../common/decorators';
import { verifyBearerSecret } from '../../common/security/webhook-auth';
import { buildPaginationMeta } from '../../common/dto/pagination.dto';
import {
  AddRecordingDto,
  CallDispositionDto,
  ClickToCallDto,
  ListCallsDto,
  StartCallDto,
  UpdateCallStatusDto,
} from './dto/call.dto';
import { CallCenterService } from './call-center.service';

@ApiTags('support:calls')
@ApiBearerAuth()
@Controller({ path: 'support/calls', version: '1' })
export class CallCenterController {
  constructor(private readonly calls: CallCenterService) {}

  @Get()
  @RequirePermissions(Permission.CALL_VIEW)
  async list(@CurrentUser() actor: AuthPrincipal, @Query() dto: ListCallsDto) {
    const r = await this.calls.list(actor, dto);
    return { items: r.items, meta: buildPaginationMeta(r.page, r.pageSize, r.total) };
  }

  @Get('missed-queue')
  @RequirePermissions(Permission.CALL_VIEW)
  @ApiOperation({ summary: 'Missed / abandoned calls awaiting recovery.' })
  missed(@CurrentUser() actor: AuthPrincipal) {
    return this.calls.listMissedQueue(actor);
  }

  @Get(':id')
  @RequirePermissions(Permission.CALL_VIEW)
  get(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.calls.get(actor, id);
  }

  @Post('click-to-call')
  @RequirePermissions(Permission.CALL_MAKE)
  @ApiOperation({ summary: 'Place an outbound call via the configured provider.' })
  clickToCall(@CurrentUser() actor: AuthPrincipal, @Body() dto: ClickToCallDto) {
    return this.calls.clickToCall(actor, dto);
  }

  @Post(':id/status')
  @RequirePermissions(Permission.CALL_MANAGE)
  @ApiOperation({ summary: 'Provider webhook target — updates call status.' })
  updateStatus(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateCallStatusDto,
  ) {
    return this.calls.updateStatus(actor.tenantId, id, dto);
  }

  @Post(':id/disposition')
  @RequirePermissions(Permission.CALL_DISPOSITION)
  setDisposition(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: CallDispositionDto,
  ) {
    return this.calls.setDisposition(actor, id, dto);
  }

  @Post(':id/recordings')
  @RequirePermissions(Permission.CALL_MANAGE)
  addRecording(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: AddRecordingDto,
  ) {
    return this.calls.addRecording(actor.tenantId, id, dto);
  }
}

/**
 * Public, provider-side webhook target. Mounted under a tenant slug or an
 * internal token so it can be reached without a bearer token. We accept
 * unauthenticated POSTs and let the provider authenticate via a shared
 * secret in the URL (recommended) or by IP allow-list at the LB.
 */
@ApiTags('webhooks:calls')
@Controller({ path: 'webhooks/calls', version: '1' })
export class CallWebhookController {
  constructor(
    private readonly calls: CallCenterService,
    @Inject(APP_CONFIG) private readonly env: LoadedServerEnv,
  ) {}

  private assertCallWebhookAuth(authorization: string | undefined): void {
    if (
      process.env['NODE_ENV'] === 'production' &&
      !verifyBearerSecret(authorization, this.env.CALL_WEBHOOK_SECRET)
    ) {
      throw new UnauthorizedException('Invalid call webhook credentials');
    }
    if (
      process.env['NODE_ENV'] === 'production' &&
      !this.env.CALL_WEBHOOK_SECRET
    ) {
      throw new UnauthorizedException('Call webhook secret not configured');
    }
  }

  @Public()
  @Post(':tenantId/start')
  start(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Body() dto: StartCallDto,
  ) {
    this.assertCallWebhookAuth(authorization);
    return this.calls.startCall(tenantId, dto);
  }

  @Public()
  @Post(':tenantId/status/:callLogId')
  status(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('callLogId') callLogId: string,
    @Body() dto: UpdateCallStatusDto,
  ) {
    this.assertCallWebhookAuth(authorization);
    return this.calls.updateStatus(tenantId, callLogId, dto);
  }

  @Public()
  @Post(':tenantId/recording/:callLogId')
  recording(
    @Headers('authorization') authorization: string | undefined,
    @Param('tenantId') tenantId: string,
    @Param('callLogId') callLogId: string,
    @Body() dto: AddRecordingDto,
  ) {
    this.assertCallWebhookAuth(authorization);
    return this.calls.addRecording(tenantId, callLogId, dto);
  }
}
