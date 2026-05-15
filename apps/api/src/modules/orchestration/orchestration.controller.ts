import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';
import { WorkflowInstanceStatus } from '@prisma/client';

import { CurrentUser, RequirePermissions } from '../../common/decorators';
import { buildPaginationMeta } from '../../common/dto/pagination.dto';
import { EventStoreService } from '../../common/events/event-store.service';
import { WorkflowAnalyticsService } from './workflow-analytics.service';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowRepository } from './workflow.repository';

@ApiTags('orchestration')
@ApiBearerAuth()
@Controller({ path: 'orchestration', version: '1' })
export class OrchestrationController {
  constructor(
    private readonly repo: WorkflowRepository,
    private readonly engine: WorkflowEngineService,
    private readonly analyticsService: WorkflowAnalyticsService,
    private readonly eventStore: EventStoreService,
  ) {}

  @Get('workflows')
  @RequirePermissions(Permission.WORKFLOW_VIEW)
  @ApiOperation({ summary: 'List workflow instances' })
  async listWorkflows(
    @CurrentUser() actor: AuthPrincipal,
    @Query('status') status?: WorkflowInstanceStatus,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
  ) {
    const [items, total] = await this.repo.listInstances(actor.tenantId, {
      status,
      page: Number(page),
      pageSize: Number(pageSize),
    });
    return {
      items,
      pagination: buildPaginationMeta(Number(page), Number(pageSize), total),
    };
  }

  @Get('workflows/:id/timeline')
  @RequirePermissions(Permission.WORKFLOW_VIEW)
  @ApiOperation({ summary: 'Workflow instance timeline' })
  async timeline(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    const instance = await this.repo.findInstance(id, actor.tenantId);
    if (!instance) {
      return { instance: null, events: [] };
    }
    const events = await this.repo.listTimeline(id);
    return { instance, events };
  }

  @Post('workflows/:id/pause')
  @RequirePermissions(Permission.WORKFLOW_MANAGE)
  pause(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.engine.pause(id, actor.tenantId);
  }

  @Post('workflows/:id/resume')
  @RequirePermissions(Permission.WORKFLOW_MANAGE)
  resume(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.engine.resume(id, actor.tenantId);
  }

  @Post('workflows/:id/cancel')
  @RequirePermissions(Permission.WORKFLOW_MANAGE)
  cancel(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.engine.cancel(id, actor.tenantId);
  }

  @Get('analytics')
  @RequirePermissions(Permission.WORKFLOW_VIEW)
  getAnalytics(@CurrentUser() actor: AuthPrincipal) {
    return this.analyticsService.dashboard(actor.tenantId);
  }

  @Get('events/replay')
  @RequirePermissions(Permission.AUTOMATION_MANAGE)
  @ApiOperation({ summary: 'List persisted events for replay' })
  async listEvents(
    @CurrentUser() actor: AuthPrincipal,
    @Query('name') name?: string,
    @Query('limit') limit = 100,
  ) {
    const events = await this.eventStore.listForReplay({
      tenantId: actor.tenantId,
      name,
      limit: Number(limit),
    });
    return { events };
  }
}
