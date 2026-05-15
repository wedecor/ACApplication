import { BookingPaymentStatus, BookingStatus } from '@ac/types';
import { Badge } from '@ac/ui';

const STATUS: Record<BookingStatus, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'info' | 'muted' }> = {
  DRAFT: { label: 'Draft', variant: 'muted' },
  PENDING: { label: 'Pending', variant: 'info' },
  CONFIRMED: { label: 'Confirmed', variant: 'secondary' },
  ASSIGNED: { label: 'Assigned', variant: 'secondary' },
  TECHNICIAN_EN_ROUTE: { label: 'En route', variant: 'warning' },
  IN_PROGRESS: { label: 'In progress', variant: 'warning' },
  WAITING_PARTS: { label: 'Waiting parts', variant: 'warning' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  CANCELLED: { label: 'Cancelled', variant: 'destructive' },
  RESCHEDULED: { label: 'Rescheduled', variant: 'info' },
  NO_SHOW: { label: 'No-show', variant: 'destructive' },
};

const PAYMENT: Record<BookingPaymentStatus, { label: string; variant: 'success' | 'warning' | 'muted' | 'destructive' }> = {
  UNPAID: { label: 'Unpaid', variant: 'muted' },
  PARTIAL: { label: 'Partial', variant: 'warning' },
  PAID: { label: 'Paid', variant: 'success' },
  REFUNDED: { label: 'Refunded', variant: 'destructive' },
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const c = STATUS[status];
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

export function BookingPaymentBadge({ status }: { status: BookingPaymentStatus }) {
  const c = PAYMENT[status];
  return <Badge variant={c.variant}>{c.label}</Badge>;
}
