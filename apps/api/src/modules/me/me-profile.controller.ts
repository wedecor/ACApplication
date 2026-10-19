import type { AuthPrincipal } from '@ac/auth';
import { Permission } from '@ac/types';
import { Body, Controller, Delete, ForbiddenException, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { AllowAuthenticated, CurrentUser, Public, RequirePermissions } from '../../common/decorators';
import { StorageService } from '../../common/storage/storage.service';
import { PurchaseAmcDto } from './dto/me-amc.dto';
import {
  CreateMyAddressDto,
  CreateMyApplianceDto,
  PresignUploadDto,
  UpdateMyAddressDto,
  UpdateMyApplianceDto,
} from './dto/me-profile.dto';
import { MeAccountService } from './me-account.service';
import { MeAddressesService } from './me-addresses.service';
import { MeAmcService } from './me-amc.service';
import { MeAppliancesService } from './me-appliances.service';
import { MeNotificationsService } from './me-notifications.service';

// ------------------------------------------------------------------ AMC

@ApiTags('me:amc')
@ApiBearerAuth()
@Controller({ path: 'me/amc', version: '1' })
export class MeAmcController {
  constructor(private readonly svc: MeAmcService) {}

  @Get()
  @RequirePermissions(Permission.SELF_SERVICE)
  @ApiOperation({ summary: 'My AMC subscriptions.' })
  mine(@CurrentUser() actor: AuthPrincipal) {
    return this.svc.mine(actor);
  }

  @Get('plans')
  @RequirePermissions(Permission.SELF_SERVICE)
  @ApiOperation({ summary: 'Active AMC plans in the customer-app shape.' })
  plans(@CurrentUser() actor: AuthPrincipal) {
    return this.svc.plans(actor);
  }

  @Post('purchase')
  @RequirePermissions(Permission.SELF_SERVICE, Permission.AMC_SUBSCRIBE)
  @ApiOperation({ summary: 'Buy an AMC plan — returns the subscription and its payable invoice.' })
  purchase(@CurrentUser() actor: AuthPrincipal, @Body() dto: PurchaseAmcDto) {
    return this.svc.purchase(actor, dto);
  }

  @Post(':id/renew')
  @RequirePermissions(Permission.SELF_SERVICE, Permission.AMC_SUBSCRIBE)
  @ApiOperation({ summary: 'Raise (or return the open) renewal invoice for my subscription.' })
  renew(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.svc.renew(actor, id);
  }
}

// -------------------------------------------------------- notifications

@ApiTags('me:notifications')
@ApiBearerAuth()
@Controller({ path: 'me/notifications', version: '1' })
export class MeNotificationsController {
  constructor(private readonly svc: MeNotificationsService) {}

  @Get()
  @RequirePermissions(Permission.SELF_SERVICE)
  @ApiOperation({ summary: 'My in-app / push notification inbox.' })
  list(@CurrentUser() actor: AuthPrincipal) {
    return this.svc.list(actor);
  }

  @Post('read-all')
  @RequirePermissions(Permission.SELF_SERVICE)
  @ApiOperation({ summary: 'Mark all my notifications read.' })
  readAll(@CurrentUser() actor: AuthPrincipal) {
    return this.svc.markAllRead(actor);
  }

  @Post(':id/read')
  @RequirePermissions(Permission.SELF_SERVICE)
  @ApiOperation({ summary: 'Mark one of my notifications read.' })
  read(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.svc.markRead(actor, id);
  }
}

// ------------------------------------------------------------ addresses

@ApiTags('me:addresses')
@ApiBearerAuth()
@Controller({ path: 'me/addresses', version: '1' })
export class MeAddressesController {
  constructor(private readonly svc: MeAddressesService) {}

  @Get()
  @RequirePermissions(Permission.SELF_SERVICE)
  @ApiOperation({ summary: 'My saved addresses (default first).' })
  list(@CurrentUser() actor: AuthPrincipal) {
    return this.svc.list(actor);
  }

  @Post()
  @RequirePermissions(Permission.SELF_SERVICE)
  @ApiOperation({ summary: 'Save a new address.' })
  create(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateMyAddressDto) {
    return this.svc.create(actor, dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.SELF_SERVICE)
  @ApiOperation({ summary: 'Update one of my addresses.' })
  update(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string, @Body() dto: UpdateMyAddressDto) {
    return this.svc.update(actor, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.SELF_SERVICE)
  @ApiOperation({ summary: 'Delete one of my addresses (soft delete).' })
  remove(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.svc.remove(actor, id);
  }

  @Post(':id/default')
  @RequirePermissions(Permission.SELF_SERVICE)
  @ApiOperation({ summary: 'Make an address my default.' })
  setDefault(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.svc.setDefault(actor, id);
  }
}

// ----------------------------------------------------------- appliances

@ApiTags('me:appliances')
@ApiBearerAuth()
@Controller({ path: 'me/appliances', version: '1' })
export class MeAppliancesController {
  constructor(private readonly svc: MeAppliancesService) {}

  @Get()
  @RequirePermissions(Permission.SELF_SERVICE)
  @ApiOperation({ summary: 'My registered appliances with warranty status.' })
  list(@CurrentUser() actor: AuthPrincipal) {
    return this.svc.list(actor);
  }

  @Get(':id')
  @RequirePermissions(Permission.SELF_SERVICE)
  @ApiOperation({ summary: 'One of my registered appliances.' })
  get(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.svc.get(actor, id);
  }

  @Post()
  @RequirePermissions(Permission.SELF_SERVICE)
  @ApiOperation({ summary: 'Register an appliance.' })
  create(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateMyApplianceDto) {
    return this.svc.create(actor, dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.SELF_SERVICE)
  @ApiOperation({ summary: 'Update one of my appliances.' })
  update(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string, @Body() dto: UpdateMyApplianceDto) {
    return this.svc.update(actor, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.SELF_SERVICE)
  @ApiOperation({ summary: 'Remove one of my appliances (soft delete).' })
  remove(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.svc.remove(actor, id);
  }
}

// -------------------------------------------------------------- devices

@ApiTags('me:devices')
@ApiBearerAuth()
@Controller({ path: 'me/devices', version: '1' })
export class MeDevicesController {
  constructor(private readonly svc: MeAccountService) {}

  @Delete(':deviceId')
  @RequirePermissions(Permission.SELF_SERVICE)
  @ApiOperation({ summary: 'Sign a device out (revokes its sessions and push tokens).' })
  revoke(@CurrentUser() actor: AuthPrincipal, @Param('deviceId') deviceId: string) {
    return this.svc.revokeDevice(actor, deviceId);
  }
}

// -------------------------------------------------------------- uploads

@ApiTags('me:uploads')
@ApiBearerAuth()
@Controller({ path: 'me/uploads', version: '1' })
export class MeUploadsController {
  constructor(private readonly storage: StorageService) {}

  @Post('presign')
  @RequirePermissions(Permission.SELF_SERVICE)
  @Throttle({ global: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Presigned PUT for a customer photo / PDF (images + pdf only, size-capped).' })
  presign(@CurrentUser() actor: AuthPrincipal, @Body() dto: PresignUploadDto) {
    return this.storage.presignUpload({ ...dto, tenantId: actor.tenantId, scope: 'customer' });
  }
}

/** Staff / technician uploads — same policy, separate key prefix. */
@ApiTags('uploads')
@ApiBearerAuth()
@Controller({ path: 'uploads', version: '1' })
export class StaffUploadsController {
  constructor(private readonly storage: StorageService) {}

  @Post('presign')
  @AllowAuthenticated()
  @Throttle({ global: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Presigned PUT for staff / technician uploads → { uploadUrl, publicUrl }.' })
  presign(@CurrentUser() actor: AuthPrincipal, @Body() dto: PresignUploadDto) {
    // Customers upload through /me/uploads/presign (customer scope), never staff scope.
    if ((actor.roles as string[]).every((r) => r === 'CUSTOMER')) {
      throw new ForbiddenException('Use /me/uploads/presign');
    }
    return this.storage.presignUpload({ ...dto, tenantId: actor.tenantId, scope: 'staff' });
  }
}

// ----------------------------------------------------------------- FAQs

@ApiTags('support')
@Controller({ path: 'support/faqs', version: '1' })
export class SupportFaqsController {
  constructor(private readonly svc: MeAccountService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Public FAQs from published knowledge-base articles.' })
  faqs(@Query('tenant') tenant?: string, @Headers('x-tenant-slug') tenantHeader?: string) {
    return this.svc.faqs(tenant ?? tenantHeader ?? null);
  }
}
