import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';

import { AMCSubscriptionStatus, Permission } from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { CurrentUser, RequirePermissions } from '../../common/decorators';
import {
  CreateAmcPlanDto,
  CreateAmcSubscriptionDto,
  UpdateAmcPlanDto,
} from './dto/amc.dto';
import { AmcPlansService } from './amc-plans.service';
import { AmcSubscriptionsService } from './amc-subscriptions.service';

@ApiTags('amc')
@ApiBearerAuth()
@Controller({ path: 'amc', version: '1' })
export class AmcController {
  constructor(
    private readonly plans: AmcPlansService,
    private readonly subs: AmcSubscriptionsService,
  ) {}

  // ----- Plans -----
  @Post('plans')
  @RequirePermissions(Permission.AMC_MANAGE)
  createPlan(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateAmcPlanDto) {
    return this.plans.create(actor, dto);
  }

  @Get('plans')
  @RequirePermissions(Permission.AMC_VIEW)
  listPlans(@CurrentUser() actor: AuthPrincipal) {
    return this.plans.list(actor);
  }

  @Get('plans/:id')
  @RequirePermissions(Permission.AMC_VIEW)
  getPlan(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.plans.get(actor, id);
  }

  @Patch('plans/:id')
  @RequirePermissions(Permission.AMC_MANAGE)
  updatePlan(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateAmcPlanDto,
  ) {
    return this.plans.update(actor, id, dto);
  }

  // ----- Subscriptions -----
  @Post('subscriptions')
  @RequirePermissions(Permission.AMC_MANAGE)
  @ApiOperation({ summary: 'Create a subscription + draft invoice for plan price.' })
  subscribe(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateAmcSubscriptionDto) {
    return this.subs.subscribe(actor, dto);
  }

  @Get('subscriptions')
  @RequirePermissions(Permission.AMC_VIEW)
  listSubs(
    @CurrentUser() actor: AuthPrincipal,
    @Query('status') status?: AMCSubscriptionStatus,
    @Query('customerId') customerId?: string,
  ) {
    return this.subs.list(actor, { status, customerId });
  }

  @Get('subscriptions/:id')
  @RequirePermissions(Permission.AMC_VIEW)
  getSub(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.subs.get(actor, id);
  }

  @Post('subscriptions/:id/cancel')
  @RequirePermissions(Permission.AMC_MANAGE)
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.subs.cancel(actor, id, body.reason);
  }

  @Post('subscriptions/:id/generate-visits')
  @RequirePermissions(Permission.AMC_MANAGE)
  @HttpCode(HttpStatus.OK)
  generate(@Param('id') id: string) {
    return this.subs.generateVisitsForSubscription(id);
  }

  @Post('subscriptions/:id/download-contract')
  @RequirePermissions(Permission.AMC_VIEW)
  @Header('Content-Type', 'application/pdf')
  async downloadContract(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const { buffer, hash } = await this.subs.renderContract(actor, id);
    reply.header('Content-Disposition', `attachment; filename="amc-${id}.pdf"`);
    reply.header('X-Pdf-Sha256', hash);
    return buffer;
  }
}
