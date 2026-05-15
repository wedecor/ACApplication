/** Workflow instance lifecycle states. */
export const WorkflowInstanceStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  WAITING: 'WAITING',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  ESCALATED: 'ESCALATED',
} as const;
export type WorkflowInstanceStatus =
  (typeof WorkflowInstanceStatus)[keyof typeof WorkflowInstanceStatus];

export const WorkflowStepStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  WAITING: 'WAITING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED',
  CANCELLED: 'CANCELLED',
} as const;
export type WorkflowStepStatus = (typeof WorkflowStepStatus)[keyof typeof WorkflowStepStatus];

export const WorkflowStepType = {
  DELAY: 'delay',
  CONDITION: 'condition',
  NOTIFY: 'notify',
  ESCALATE: 'escalate',
  PARALLEL: 'parallel',
  SET_CONTEXT: 'set_context',
  COMPLETE: 'complete',
  AI_DECISION: 'ai_decision',
} as const;
export type WorkflowStepType = (typeof WorkflowStepType)[keyof typeof WorkflowStepType];

export interface WorkflowStepDefinition {
  key: string;
  type: WorkflowStepType;
  /** Next step when this step completes (default linear flow). */
  next?: string;
  /** Milliseconds to wait (delay step). */
  delayMs?: number;
  /** ISO-8601 duration e.g. PT15M — resolved at runtime with timezone. */
  delayIso?: string;
  /** Branch targets. */
  onTrue?: string;
  onFalse?: string;
  /** Rule condition tree (condition step). */
  when?: RuleConditionGroup;
  /** Notification template (notify step). */
  template?: string;
  channels?: string[];
  recipient?: 'customer' | 'technician' | 'dispatch' | 'custom';
  customUserIdField?: string;
  /** Escalation (escalate step). */
  escalationLevel?: number;
  escalationTarget?: 'technician' | 'support' | 'management' | 'dispatch';
  reason?: string;
  /** Parallel child step keys. */
  branches?: string[];
  /** Context mutations. */
  set?: Record<string, unknown>;
  /** AI hook — defers to pluggable decision engine. */
  aiHook?: string;
  maxAttempts?: number;
}

export interface WorkflowDefinitionBody {
  version: number;
  steps: WorkflowStepDefinition[];
  /** First step key; defaults to steps[0].key */
  startAt?: string;
  timezone?: string;
}

export interface RuleCondition {
  field: string;
  op?: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
  value?: unknown;
}

export interface RuleConditionGroup {
  and?: Array<RuleCondition | RuleConditionGroup>;
  or?: Array<RuleCondition | RuleConditionGroup>;
}

export interface AutomationRuleAction {
  type: 'start_workflow' | 'notify' | 'escalate' | 'set_priority';
  workflowKey?: string;
  template?: string;
  channels?: string[];
  escalationLevel?: number;
  priority?: string;
}

export interface AutomationRuleBody {
  conditions: RuleConditionGroup;
  actions: AutomationRuleAction[];
}

export const WORKFLOW_STEP_QUEUE = 'workflow-step-execution';
export const WORKFLOW_SCHEDULE_QUEUE = 'workflow-scheduled-trigger';
export const DOMAIN_EVENT_DLQ = 'domain-event-dlq';

export interface WorkflowStepJobPayload {
  stepExecutionId: string;
  instanceId: string;
  tenantId: string;
  correlationId: string;
}

export interface WorkflowScheduleJobPayload {
  type: 'cron' | 'delayed_rule' | 'sla_check';
  tenantId: string;
  ruleId?: string;
  workflowInstanceId?: string;
  scheduledAt: string;
}
