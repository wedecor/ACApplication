import { LeadPriority } from '@ac/types';
import { Badge } from '@ac/ui';

const VARIANTS: Record<LeadPriority, { label: string; variant: 'muted' | 'secondary' | 'warning' | 'destructive' }> = {
  LOW: { label: 'Low', variant: 'muted' },
  NORMAL: { label: 'Normal', variant: 'secondary' },
  HIGH: { label: 'High', variant: 'warning' },
  URGENT: { label: 'Urgent', variant: 'destructive' },
};

export function LeadPriorityBadge({ priority }: { priority: LeadPriority }) {
  const cfg = VARIANTS[priority];
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
