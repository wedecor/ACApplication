'use client';

import { AlertTriangle, BellOff, CheckCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import { Badge, Button, Card } from '@ac/ui';

import { useAcknowledgeAlert, useDispatchAlerts } from '@/hooks/use-dispatch';
import type { DispatchAlert } from '@/lib/api/dispatch';

const SEVERITY: Record<DispatchAlert['severity'], { variant: 'destructive' | 'warning' | 'info'; icon: string; label: string }> = {
  critical: { variant: 'destructive', icon: 'text-danger-600', label: 'Critical' },
  warning: { variant: 'warning', icon: 'text-warning-600', label: 'Warning' },
  info: { variant: 'info', icon: 'text-info-600', label: 'Info' },
};

const KIND_LABEL: Record<DispatchAlert['kind'], string> = {
  TECHNICIAN_DELAYED: 'Technician delayed',
  TECHNICIAN_UNREACHABLE: 'Technician unreachable',
  BOOKING_OVERDUE: 'Booking overdue',
  LOW_AVAILABILITY: 'Low availability',
  NO_CANDIDATES: 'No candidates',
};

export function AlertFeed({ cityId }: { cityId: string | null }) {
  const { data: alerts = [] } = useDispatchAlerts(cityId);
  const ack = useAcknowledgeAlert();

  if (alerts.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-1 p-4 text-center">
        <BellOff className="size-5 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium">No active alerts</p>
        <p className="text-sm text-muted-foreground">Everything is running on schedule.</p>
      </Card>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {alerts.map((alert) => {
        const sev = SEVERITY[alert.severity];
        const title = KIND_LABEL[alert.kind] ?? alert.kind;
        return (
          <li key={alert.id} className="flex items-start gap-3 rounded-lg border bg-card p-3">
            <AlertTriangle className={`mt-0.5 size-4 shrink-0 ${sev.icon}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{title}</span>
                <Badge variant={sev.variant}>{sev.label}</Badge>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">{alert.message}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="-mr-1 -mt-1 size-10 shrink-0"
              aria-label={`Acknowledge: ${title}`}
              title="Acknowledge"
              onClick={() => ack.mutate({ id: alert.id })}
              disabled={ack.isPending && ack.variables?.id === alert.id}
            >
              <CheckCheck className="size-4" aria-hidden />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
