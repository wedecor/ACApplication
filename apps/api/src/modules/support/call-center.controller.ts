import type { AuthPrincipal } from '@ac/auth';
import type { LoadedServerEnv } from '@ac/config';
import { Permission } from '@ac/types';
import {
  Body,
  Controller,
  Get,
  Headers,
 Inject,  Param,
  Post,
  Query,
  UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { APP_CONFIG } from '../../common/config/config.module';
import { CurrentUser, Public, RequirePermissions } from '../../common/decorators';
import { buildPaginationMeta } from '../../common/dto/pagination.dto';
import { isLocalDevelopment, verifyBearerSecret } from '../../common/security/webhook-auth';
import { CallCenterService } from './call-center.service';
import {
  AddRecordingDto,
  CallDispositionDto,
  ClickToCallDto,
  ListCallsDto,
  StartCallDto,
  UpdateCallStatusDto,
} from './dto/call.dto';

@ApiTags('support:calls')
@ApiBearerAuth()
@Controller({ path: 'support/calls', version: '1' })
export class CallCenterController {
  constructor(private readonly calls: CallCenterService) {}

  @Get()
  @RequirePermissions(Permission.CALL_VIEW)
  @ApiOperation({ summary: 'List call center logs with pagination.' })
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
  @ApiOperation({ summary: 'Get call log details by ID.' })
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
  @ApiOperation({ summary: 'Set call outcome disposition and notes.' })
  setDisposition(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: CallDispositionDto,
  ) {
    return this.calls.setDisposition(actor, id, dto);
  }

  @Post(':id/recordings')
  @RequirePermissions(Permission.CALL_MANAGE)
  @ApiOperation({ summary: 'Attach a call audio recording to a call log.' })
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
    // Enforced everywhere except local development (staging used to accept anyone).
    if (isLocalDevelopment() && !this.env.CALL_WEBHOOK_SECRET) return;
    if (!verifyBearerSecret(authorization, this.env.CALL_WEBHOOK_SECRET)) {
      throw new UnauthorizedException('Invalid call webhook credentials');
    }
  }

  @Public()
  @Post(':tenantId/start')
  @ApiOperation({ summary: 'Provider webhook to initiate an incoming or outgoing call session.' })
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
  @ApiOperation({ summary: 'Provider webhook to update call session status.' })
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
  @ApiOperation({ summary: 'Provider webhook to receive completed call recording URL.' })
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
