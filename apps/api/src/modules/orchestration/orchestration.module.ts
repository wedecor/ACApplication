import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { NotificationsModule } from '../notifications/notifications.module';
import { AiContextService } from './ai-context.service';
import { EscalationEngineService } from './escalation-engine.service';
import { OrchestrationController } from './orchestration.controller';
import { OrchestrationListener } from './orchestration.listener';
import { RuleEngineService } from './rule-engine.service';
import { WorkflowAnalyticsService } from './workflow-analytics.service';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowQueueService } from './workflow-queue.service';
import { WorkflowRepository } from './workflow.repository';
import { WorkflowSchedulerService } from './workflow-scheduler.service';
import { WorkflowSeedService } from './workflow-seed.service';

@Module({
  imports: [ScheduleModule.forRoot(), NotificationsModule],
  controllers: [OrchestrationController],
  providers: [
    WorkflowRepository,
    WorkflowQueueService,
    WorkflowEngineService,
    RuleEngineService,
    EscalationEngineService,
    WorkflowSchedulerService,
    WorkflowAnalyticsService,
    WorkflowSeedService,
    AiContextService,
    OrchestrationListener,
  ],
  exports: [WorkflowEngineService, WorkflowRepository],
})
export class OrchestrationModule {}
