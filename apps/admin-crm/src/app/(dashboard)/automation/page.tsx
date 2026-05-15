'use client';

import * as React from 'react';
import { GitBranch, Pause, Play, XCircle } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ac/ui';

import {
  useCancelWorkflow,
  usePauseWorkflow,
  useResumeWorkflow,
  useWorkflowAnalytics,
  useWorkflowTimeline,
  useWorkflows,
} from '@/hooks/use-orchestration';
import type { WorkflowInstanceStatus } from '@/lib/api/orchestration';
import { formatDate } from '@/lib/format';

const STATUS_FILTERS: Array<{ id: WorkflowInstanceStatus | 'ALL'; label: string }> = [
  { id: 'ALL', label: 'All' },
  { id: 'RUNNING', label: 'Running' },
  { id: 'WAITING', label: 'Waiting' },
  { id: 'PAUSED', label: 'Paused' },
  { id: 'COMPLETED', label: 'Completed' },
  { id: 'FAILED', label: 'Failed' },
  { id: 'ESCALATED', label: 'Escalated' },
];

const STATUS_BADGE: Record<
  WorkflowInstanceStatus,
  'default' | 'destructive' | 'outline' | 'secondary'
> = {
  PENDING: 'secondary',
  RUNNING: 'outline',
  WAITING: 'outline',
  PAUSED: 'secondary',
  COMPLETED: 'default',
  FAILED: 'destructive',
  CANCELLED: 'secondary',
  ESCALATED: 'destructive',
};

export default function AutomationPage() {
  const [status, setStatus] = React.useState<WorkflowInstanceStatus | undefined>(undefined);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const { data: analytics } = useWorkflowAnalytics();
  const { data, isLoading, error } = useWorkflows({ status });
  const { data: timeline } = useWorkflowTimeline(selectedId);
  const pause = usePauseWorkflow();
  const resume = useResumeWorkflow();
  const cancel = useCancelWorkflow();
  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Automation</h1>
        <p className="text-sm text-muted-foreground">
          Workflow instances, escalations, and orchestration health (7-day window).
        </p>
      </header>

      {analytics ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard title="Active workflows" value={String(analytics.total)} sub="Last 7 days" />
          <MetricCard
            title="Success rate"
            value={`${Math.round(analytics.successRate * 100)}%`}
            sub="Completed / total"
          />
          <MetricCard
            title="Escalations"
            value={String(analytics.escalations)}
            sub={`${analytics.stuckWorkflows} stuck`}
            alert={analytics.stuckWorkflows > 0}
          />
          <MetricCard
            title="Avg step attempts"
            value={analytics.avgStepAttempts.toFixed(1)}
            sub="Per completed step"
          />
        </div>
      ) : (
        <Skeleton className="h-24 w-full" />
      )}

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <Button
            key={f.id}
            size="sm"
            variant={(f.id === 'ALL' ? !status : status === f.id) ? 'default' : 'outline'}
            onClick={() => setStatus(f.id === 'ALL' ? undefined : f.id)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Workflow instances</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : error ? (
              <EmptyState title="Failed to load workflows" description={error.message} />
            ) : items.length === 0 ? (
              <EmptyState
                icon={GitBranch}
                title="No workflows"
                description="Instances appear when domain events trigger automation."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Definition</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Step</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer"
                      data-state={selectedId === row.id ? 'selected' : undefined}
                      onClick={() => setSelectedId(row.id)}
                    >
                      <TableCell className="font-medium">{row.definitionKey}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_BADGE[row.status]}>{row.status}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.currentStepKey ?? '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(row.updatedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!selectedId ? (
              <p className="text-sm text-muted-foreground">Select a workflow to inspect events.</p>
            ) : !timeline?.instance ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {timeline.instance.status === 'RUNNING' ||
                  timeline.instance.status === 'WAITING' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pause.isPending}
                      onClick={() => pause.mutate(selectedId)}
                    >
                      <Pause className="mr-1 size-3" />
                      Pause
                    </Button>
                  ) : null}
                  {timeline.instance.status === 'PAUSED' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={resume.isPending}
                      onClick={() => resume.mutate(selectedId)}
                    >
                      <Play className="mr-1 size-3" />
                      Resume
                    </Button>
                  ) : null}
                  {['RUNNING', 'WAITING', 'PAUSED', 'PENDING'].includes(
                    timeline.instance.status,
                  ) ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={cancel.isPending}
                      onClick={() => cancel.mutate(selectedId)}
                    >
                      <XCircle className="mr-1 size-3" />
                      Cancel
                    </Button>
                  ) : null}
                </div>
                <ul className="space-y-2 text-sm">
                  {(timeline.events ?? []).map((ev) => (
                    <li key={ev.id} className="rounded-md border p-2">
                      <div className="font-medium">{ev.eventType}</div>
                      {ev.detail ? (
                        <p className="text-muted-foreground">{ev.detail}</p>
                      ) : null}
                      <p className="text-xs text-muted-foreground">{formatDate(ev.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  sub,
  alert,
}: {
  title: string;
  value: string;
  sub: string;
  alert?: boolean;
}) {
  return (
    <Card className={alert ? 'border-destructive' : undefined}>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}
