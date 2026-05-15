import { LeadStatus } from '@ac/types';
import { Badge } from '@ac/ui';

const VARIANTS: Record<LeadStatus, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'info' | 'muted' }> = {
  NEW: { label: 'New', variant: 'info' },
  CONTACTED: { label: 'Contacted', variant: 'secondary' },
  QUALIFIED: { label: 'Qualified', variant: 'warning' },
  BOOKING_CREATED: { label: 'Converted', variant: 'success' },
  CANCELLED: { label: 'Cancelled', variant: 'muted' },
  SPAM: { label: 'Spam', variant: 'destructive' },
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const config = VARIANTS[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
