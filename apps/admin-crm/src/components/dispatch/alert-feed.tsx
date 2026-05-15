'use client';

import { AlertTriangle, BellOff, CheckCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import { Badge, Button, Card } from '@ac/ui';

import { useAcknowledgeAlert, useDispatchAlerts } from '@/hooks/use-dispatch';

const SEVERITY_STYLES: Record<'info' | 'warning' | 'critical', { variant: 'destructive' | 'default' | 'secondary'; ring: string }> = {
  critical: { variant: 'destructive', ring: 'ring-red-300' },
  warning: { variant: 'default', ring: 'ring-amber-300' },
  info: { variant: 'secondary', ring: 'ring-blue-200' },
};

export function AlertFeed({ cityId }: { cityId: string | null }) {
  const { data: alerts = [] } = useDispatchAlerts(cityId);
  const ack = useAcknowledgeAlert();

  if (alerts.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-1 p-4 text-center">
        <BellOff className="h-5 w-5 text-muted-foreground" />
        <p className="text-sm font-medium">No active alerts</p>
        <p className="text-xs text-muted-foreground">Everything is running on schedule.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {alerts.map((alert) => {
        const style = SEVERITY_STYLES[alert.severity];
        return (
          <Card key={alert.id} className={`flex items-start gap-3 p-3 ring-1 ${style.ring}`}>
            <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{alert.kind.replace(/_/g, ' ')}</span>
                <Badge variant={style.variant}>{alert.severity}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{alert.message}</p>
              <p className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(alert.createdAt))} ago
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => ack.mutate({ id: alert.id })}
              disabled={ack.isPending}
            >
              <CheckCheck className="h-3 w-3" />
            </Button>
          </Card>
        );
      })}
    </div>
  );
}
