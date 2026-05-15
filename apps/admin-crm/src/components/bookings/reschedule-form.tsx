'use client';

import { Button, Input } from '@ac/ui';
import * as React from 'react';
import { toast } from 'sonner';

import { useRescheduleBooking } from '@/hooks/use-bookings';

export function RescheduleForm({ id, current }: { id: string; current: string }) {
  const { mutateAsync, isPending } = useRescheduleBooking(id);
  const initial = new Date(current);
  const [value, setValue] = React.useState(
    new Date(initial.getTime() - initial.getTimezoneOffset() * 60_000).toISOString().slice(0, 16),
  );
  const [slot, setSlot] = React.useState('');
  const [reason, setReason] = React.useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await mutateAsync({
        scheduledAt: new Date(value).toISOString(),
        scheduledTimeSlot: slot || undefined,
        reason: reason || undefined,
      });
      toast.success('Booking rescheduled');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="New date / time">
        <Input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} />
      </Field>
      <Field label="Time slot (optional)">
        <Input placeholder="10:00-12:00" value={slot} onChange={(e) => setSlot(e.target.value)} />
      </Field>
      <Field label="Reason">
        <Input value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <Button type="submit" disabled={isPending}>
        Reschedule
      </Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
