'use client';

import { BookingStatus, canTransitionBooking, TERMINAL_BOOKING_STATUSES } from '@ac/types';
import { Button, Input, Label } from '@ac/ui';
import { useState } from 'react';
import { toast } from 'sonner';

import { useChangeBookingStatus, useSendBookingOtp } from '@/hooks/use-bookings';
import { humanizeEnum } from '@/lib/labels';

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
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [reason, setReason] = useState('');

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

  const run = async (to: BookingStatus, why?: string) => {
    try {
      await mutateAsync({ status: to, reason: why });
      toast.success(to === BookingStatus.CANCELLED ? 'Booking cancelled' : `Status set to ${humanizeEnum(to)}`);
      setConfirmingCancel(false);
      setReason('');
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
          variant="outline"
          className={s === BookingStatus.CANCELLED ? 'border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive' : undefined}
          onClick={() => (s === BookingStatus.CANCELLED ? setConfirmingCancel(true) : run(s))}
          aria-expanded={s === BookingStatus.CANCELLED ? confirmingCancel : undefined}
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
      {confirmingCancel ? (
        <form
          className="mt-1 w-full space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run(BookingStatus.CANCELLED, reason.trim());
          }}
        >
          <Label htmlFor={`cancel-reason-${id}`}>Why is this booking being cancelled?</Label>
          <Input
            id={`cancel-reason-${id}`}
            autoFocus
            required
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Customer fixed it themselves"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" variant="destructive" disabled={isPending || !reason.trim()}>
              Cancel booking
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmingCancel(false)}>
              Keep booking
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
