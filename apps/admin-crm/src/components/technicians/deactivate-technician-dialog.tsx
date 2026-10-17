'use client';

import {
  Button,
  Label,
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from '@ac/ui';
import * as React from 'react';
import { toast } from 'sonner';

import { useDeactivateTechnician } from '@/hooks/use-technicians';
import { apiErrorMessage, isApiError } from '@/lib/api/error-message';

interface Props {
  technician: { id: string; fullName: string } | null;
  onOpenChange: (open: boolean) => void;
}

export function DeactivateTechnicianDialog({ technician, onOpenChange }: Props) {
  const deactivate = useDeactivateTechnician();
  const [reason, setReason] = React.useState('');
  const [openBookings, setOpenBookings] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setReason('');
    setOpenBookings(null);
    setError(null);
  }, [technician?.id]);

  if (!technician) return null;

  const submit = async (force: boolean) => {
    setError(null);
    try {
      const res = await deactivate.mutateAsync({ id: technician.id, reason: reason || undefined, force });
      toast.success(
        res.openBookingsLeftAssigned > 0
          ? `${technician.fullName} deactivated — ${res.openBookingsLeftAssigned} open booking(s) need reassignment`
          : `${technician.fullName} deactivated`,
      );
      onOpenChange(false);
    } catch (err) {
      if (isApiError(err, 409, 'TECHNICIAN_HAS_OPEN_BOOKINGS')) {
        const details = (err as { details?: { details?: { openBookings?: number } } }).details;
        setOpenBookings(details?.details?.openBookings ?? 1);
        return;
      }
      setError(apiErrorMessage(err, 'Failed to deactivate technician'));
    }
  };

  return (
    <Modal open onOpenChange={onOpenChange}>
      <ModalContent className="max-w-md">
        <ModalHeader>
          <ModalTitle>Deactivate {technician.fullName}?</ModalTitle>
          <ModalDescription>
            They will be signed out, set offline and unable to log in until reactivated. Their history is kept.
          </ModalDescription>
        </ModalHeader>
        <div className="space-y-3">
          <div>
            <Label className="mb-1 block text-xs" htmlFor="deactivate-reason">
              Reason (optional)
            </Label>
            <textarea
              id="deactivate-reason"
              rows={2}
              maxLength={500}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          {openBookings !== null ? (
            <p role="alert" className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-sm">
              This technician still has {openBookings} open booking(s). Reassign them from Dispatch first, or
              deactivate anyway and reassign afterwards.
            </p>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {openBookings !== null ? (
            <Button variant="destructive" disabled={deactivate.isPending} onClick={() => void submit(true)}>
              Deactivate anyway
            </Button>
          ) : (
            <Button variant="destructive" disabled={deactivate.isPending} onClick={() => void submit(false)}>
              {deactivate.isPending ? 'Deactivating…' : 'Deactivate'}
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
