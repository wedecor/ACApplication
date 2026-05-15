'use client';

import { formatDistanceToNow } from 'date-fns';
import { ArrowRightLeft, Sparkles, UserCheck, UserPlus } from 'lucide-react';

import { Card } from '@ac/ui';

import { useRecentDecisions } from '@/hooks/use-dispatch';

const ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  AUTO_ASSIGNED: Sparkles,
  MANUAL_ASSIGNED: UserPlus,
  REASSIGNED: ArrowRightLeft,
  RECOMMENDED: UserCheck,
};

export function ActivityFeed({ cityId }: { cityId: string | null }) {
  const { data: decisions = [] } = useRecentDecisions(cityId);

  return (
    <Card className="flex flex-col gap-3 p-4">
      <p className="text-sm font-semibold">Live activity</p>
      <div className="flex flex-col gap-2">
        {decisions.slice(0, 12).map((d) => {
          const Icon = ICON[d.decision] ?? Sparkles;
          return (
            <div key={d.id} className="flex items-start gap-2 text-xs">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-muted">
                <Icon className="h-3 w-3" />
              </span>
              <div className="flex-1">
                <p className="text-foreground">
                  <span className="font-medium">{d.technician?.fullName ?? 'Technician'}</span>{' '}
                  {d.decision.toLowerCase().replace(/_/g, ' ')}
                </p>
                <p className="text-muted-foreground">
                  {formatDistanceToNow(new Date(d.createdAt))} ago
                  {d.etaMin != null ? ` • ETA ${Math.round(d.etaMin)}min` : ''}
                </p>
              </div>
            </div>
          );
        })}
        {decisions.length === 0 ? (
          <p className="text-xs text-muted-foreground">No dispatch activity yet today.</p>
        ) : null}
      </div>
    </Card>
  );
}
