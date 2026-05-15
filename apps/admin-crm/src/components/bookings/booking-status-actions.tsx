'use client';

import { BookingStatus, canTransitionBooking, TERMINAL_BOOKING_STATUSES } from '@ac/types';
import { Button } from '@ac/ui';
import { toast } from 'sonner';

import { useChangeBookingStatus, useSendBookingOtp } from '@/hooks/use-bookings';

const LABELS: Record<BookingStatus, string> = {
  DRAFT: 'Draft',
  PENDING: 'Pending',
  CONFIRMED: 'Confirm',
  ASSIGNED: 'Mark assigned',
  TECHNICIAN_EN_ROUTE: 'En route',
  IN_PROGRESS: 'Start service',
  WAITING_PARTS: 'Waiting parts',
  COMPLETED: 'Complete',
  CANCELLED: 'Cancel',
  RESCHEDULED: 'Rescheduled',
  NO_SHOW: 'No-show',
};

export function BookingStatusActions({
  id,
  current,
}: {
  id: string;
  current: BookingStatus;
}) {
  const { mutateAsync, isPending } = useChangeBookingStatus(id);
  const { mutateAsync: sendOtp, isPending: sendingOtp } = useSendBookingOtp(id);

  if (TERMINAL_BOOKING_STATUSES.has(current)) {
    return <p className="text-xs text-muted-foreground">Booking is closed.</p>;
  }

  const candidates: BookingStatus[] = [
    BookingStatus.CONFIRMED,
    BookingStatus.TECHNICIAN_EN_ROUTE,
    BookingStatus.WAITING_PARTS,
    BookingStatus.IN_PROGRESS,
    BookingStatus.COMPLETED,
    BookingStatus.CANCELLED,
  ].filter((s) => s !== current && canTransitionBooking(current, s));

  const run = async (to: BookingStatus) => {
    try {
      await mutateAsync({ status: to });
      toast.success(`Status set to ${to}`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const onSendOtp = async () => {
    try {
      const res = await sendOtp();
      const devCode = (res as { devCode?: string }).devCode;
      toast.success(devCode ? `OTP sent (dev: ${devCode})` : 'OTP sent');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {candidates.map((s) => (
        <Button
          key={s}
          size="sm"
          variant={s === BookingStatus.CANCELLED ? 'destructive' : 'outline'}
          onClick={() => run(s)}
          disabled={isPending}
        >
          {LABELS[s]}
        </Button>
      ))}
      {current === BookingStatus.TECHNICIAN_EN_ROUTE ? (
        <Button size="sm" onClick={onSendOtp} disabled={sendingOtp}>
          Send arrival OTP
        </Button>
      ) : null}
    </div>
  );
}
