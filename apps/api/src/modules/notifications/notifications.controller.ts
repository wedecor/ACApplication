import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { AllowAuthenticated, CurrentUser, RequirePermissions } from '../../common/decorators';
import { buildPaginationMeta } from '../../common/dto/pagination.dto';
import { NotificationRepository } from './notification.repository';
import { NotificationsService } from './notifications.service';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { RegisterPushDeviceDto } from './dto/register-push-device.dto';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly repo: NotificationRepository,
  ) {}

  @AllowAuthenticated()
  @Post('devices')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Register or refresh a mobile push device token.' })
  async registerDevice(
    @CurrentUser() actor: AuthPrincipal,
    @Body() dto: RegisterPushDeviceDto,
  ): Promise<void> {
    await this.repo.registerPushDevice({
      tenantId: actor.tenantId,
      userId: actor.userId,
      token: dto.token,
      provider: dto.provider ?? 'expo',
      platform: dto.platform,
      deviceId: dto.deviceId,
      modelName: dto.modelName,
      osVersion: dto.osVersion,
      appVersion: dto.appVersion,
    });
  }

  @AllowAuthenticated()
  @Delete('devices')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate a push device token.' })
  async unregisterDevice(
    @CurrentUser() actor: AuthPrincipal,
    @Query('token') token: string,
  ): Promise<void> {
    if (!token) return;
    await this.repo.deactivatePushDevice(actor.userId, token);
  }

  @Get()
  @RequirePermissions(Permission.NOTIFICATION_VIEW)
  @ApiOperation({ summary: 'List notification delivery logs for the tenant.' })
  async list(@CurrentUser() actor: AuthPrincipal, @Query() query: ListNotificationsDto) {
    const { items, total } = await this.repo.listForTenant(actor.tenantId, {
      status: query.status,
      channel: query.channel,
      search: query.search,
      page: query.page,
      pageSize: query.pageSize,
    });
    return {
      items,
      pagination: buildPaginationMeta(query.page, query.pageSize, total),
    };
  }

  @Get(':id/timeline')
  @RequirePermissions(Permission.NOTIFICATION_VIEW)
  @ApiOperation({ summary: 'Delivery lifecycle timeline for a notification.' })
  async timeline(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    const row = await this.repo.findById(id);
    if (!row || row.tenantId !== actor.tenantId) {
      return { notification: null, events: [] };
    }
    const events = await this.repo.listDeliveryEvents(id);
    return { notification: row, events };
  }

  @Post(':id/retry')
  @RequirePermissions(Permission.NOTIFICATION_RETRY)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Re-queue a failed notification for delivery.' })
  async retry(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    await this.notifications.retry(id, actor.tenantId);
    return { id, status: 'queued' };
  }
}
