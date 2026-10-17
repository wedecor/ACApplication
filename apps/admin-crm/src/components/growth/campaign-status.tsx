import { Badge } from '@ac/ui';

import type { CampaignStatus } from '@/lib/api/growth';

const VARIANT: Record<CampaignStatus, 'muted' | 'info' | 'warning' | 'success' | 'destructive'> = {
  DRAFT: 'muted',
  SCHEDULED: 'info',
  RUNNING: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'destructive',
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  return <Badge variant={VARIANT[status] ?? 'muted'}>{status}</Badge>;
}
