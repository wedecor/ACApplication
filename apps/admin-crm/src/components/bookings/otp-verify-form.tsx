'use client';

import { Button, Input } from '@ac/ui';
import * as React from 'react';
import { toast } from 'sonner';

import { useVerifyBookingOtp } from '@/hooks/use-bookings';

export function OtpVerifyForm({ id }: { id: string }) {
  const { mutateAsync, isPending } = useVerifyBookingOtp(id);
  const [code, setCode] = React.useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 4) return;
    try {
      await mutateAsync(code);
      toast.success('OTP verified — service started');
      setCode('');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <form onSubmit={submit} className="flex items-end gap-2">
      <div className="flex-1">
        <label className="mb-1 block text-xs uppercase text-muted-foreground">
          Customer OTP
        </label>
        <Input
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={8}
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        />
      </div>
      <Button type="submit" disabled={isPending || code.length < 4}>
        Verify
      </Button>
    </form>
  );
}
