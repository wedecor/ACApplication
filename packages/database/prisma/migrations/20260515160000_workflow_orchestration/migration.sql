-- CreateEnum
CREATE TYPE "WorkflowInstanceStatus" AS ENUM ('PENDING', 'RUNNING', 'WAITING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED', 'ESCALATED');
CREATE TYPE "WorkflowStepExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'WAITING', 'COMPLETED', 'FAILED', 'SKIPPED', 'CANCELLED');
CREATE TYPE "DomainEventRecordStatus" AS ENUM ('PUBLISHED', 'PROCESSED', 'DEAD', 'REPLAYED');

-- CreateTable
CREATE TABLE "workflow_definitions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "triggerEvent" TEXT,
    "definition" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "workflow_definitions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workflow_instances" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "definitionKey" TEXT NOT NULL,
    "definitionVer" INTEGER NOT NULL,
    "correlationId" TEXT NOT NULL,
    "status" "WorkflowInstanceStatus" NOT NULL DEFAULT 'PENDING',
    "context" JSONB NOT NULL DEFAULT '{}',
    "resourceType" TEXT,
    "resourceId" TEXT,
    "currentStepKey" TEXT,
    "idempotencyKey" TEXT,
    "aiSnapshot" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "workflow_instances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workflow_step_executions" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "stepKey" TEXT NOT NULL,
    "stepType" TEXT NOT NULL,
    "status" "WorkflowStepExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "output" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "workflow_step_executions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workflow_events" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "stepKey" TEXT,
    "eventType" TEXT NOT NULL,
    "detail" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workflow_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "domain_event_records" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "name" TEXT NOT NULL,
    "schemaVer" INTEGER NOT NULL DEFAULT 1,
    "envelope" JSONB NOT NULL,
    "status" "DomainEventRecordStatus" NOT NULL DEFAULT 'PUBLISHED',
    "traceId" TEXT,
    "replayOf" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    CONSTRAINT "domain_event_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "automation_rules" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "triggerEvent" TEXT NOT NULL,
    "conditions" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "cronExpr" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sla_policies" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "thresholds" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "sla_policies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "escalation_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "policyId" TEXT,
    "instanceId" TEXT,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "target" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "escalation_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workflow_schedules" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cronExpr" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "workflowKey" TEXT,
    "ruleId" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "workflow_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workflow_definitions_tenantId_key_version_key" ON "workflow_definitions"("tenantId", "key", "version");
CREATE INDEX "workflow_definitions_triggerEvent_isActive_idx" ON "workflow_definitions"("triggerEvent", "isActive");

CREATE UNIQUE INDEX "workflow_instances_tenantId_idempotencyKey_key" ON "workflow_instances"("tenantId", "idempotencyKey");
CREATE INDEX "workflow_instances_tenantId_status_createdAt_idx" ON "workflow_instances"("tenantId", "status", "createdAt");
CREATE INDEX "workflow_instances_resourceType_resourceId_idx" ON "workflow_instances"("resourceType", "resourceId");
CREATE INDEX "workflow_instances_correlationId_idx" ON "workflow_instances"("correlationId");

CREATE UNIQUE INDEX "workflow_step_executions_instanceId_stepKey_key" ON "workflow_step_executions"("instanceId", "stepKey");
CREATE INDEX "workflow_step_executions_instanceId_status_idx" ON "workflow_step_executions"("instanceId", "status");
CREATE INDEX "workflow_step_executions_scheduledAt_status_idx" ON "workflow_step_executions"("scheduledAt", "status");

CREATE INDEX "workflow_events_instanceId_createdAt_idx" ON "workflow_events"("instanceId", "createdAt");

CREATE INDEX "domain_event_records_tenantId_name_createdAt_idx" ON "domain_event_records"("tenantId", "name", "createdAt");
CREATE INDEX "domain_event_records_status_createdAt_idx" ON "domain_event_records"("status", "createdAt");
CREATE INDEX "domain_event_records_traceId_idx" ON "domain_event_records"("traceId");

CREATE INDEX "automation_rules_tenantId_triggerEvent_isActive_priority_idx" ON "automation_rules"("tenantId", "triggerEvent", "isActive", "priority");

CREATE UNIQUE INDEX "sla_policies_tenantId_key_key" ON "sla_policies"("tenantId", "key");
CREATE INDEX "sla_policies_tenantId_resourceType_isActive_idx" ON "sla_policies"("tenantId", "resourceType", "isActive");

CREATE INDEX "escalation_logs_tenantId_resourceType_resourceId_idx" ON "escalation_logs"("tenantId", "resourceType", "resourceId");
CREATE INDEX "escalation_logs_instanceId_idx" ON "escalation_logs"("instanceId");

CREATE INDEX "workflow_schedules_tenantId_isActive_nextRunAt_idx" ON "workflow_schedules"("tenantId", "isActive", "nextRunAt");

-- AddForeignKey
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "workflow_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workflow_step_executions" ADD CONSTRAINT "workflow_step_executions_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "workflow_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_events" ADD CONSTRAINT "workflow_events_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "workflow_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "escalation_logs" ADD CONSTRAINT "escalation_logs_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "sla_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "escalation_logs" ADD CONSTRAINT "escalation_logs_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "workflow_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;
