'use client';

import { Button, Input, ModalFooter } from '@ac/ui';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { Field } from '@/components/common/form-field';
import { SimpleModal } from '@/components/common/simple-modal';
import { useMergeCustomer } from '@/hooks/use-customers';
import type { CustomerDetail } from '@/lib/api/customers';
import { errorMessage } from '@/lib/crm-format';

/**
 * Merge `duplicate` into `survivor`. Everything (bookings, invoices, AMC,
 * appliances, ledger …) moves to the survivor; the duplicate is soft-deleted.
 */
export function CustomerMergeModal({
  open,
  onOpenChange,
  duplicate,
  survivor,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicate: Pick<CustomerDetail, 'id' | 'fullName' | 'phone'> | null;
  survivor: Pick<CustomerDetail, 'id' | 'fullName' | 'phone'> | null;
}) {
  const router = useRouter();
  const merge = useMergeCustomer();
  const [confirm, setConfirm] = React.useState('');

  React.useEffect(() => {
    if (open) setConfirm('');
  }, [open]);

  if (!duplicate || !survivor) return null;

  const onMerge = async () => {
    try {
      const result = await merge.mutateAsync({ id: duplicate.id, intoCustomerId: survivor.id });
      toast.success(`Merged into ${result.fullName ?? survivor.fullName}`);
      onOpenChange(false);
      router.push(`/customers/${survivor.id}`);
    } catch (err) {
      toast.error(errorMessage(err, 'Merge failed'));
    }
  };

  return (
    <SimpleModal
      open={open}
      onOpenChange={onOpenChange}
      title="Merge customers"
      description="This cannot be undone from the UI."
    >
      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
            <p className="text-sm text-muted-foreground">Duplicate (removed)</p>
            <p className="font-medium">{duplicate.fullName}</p>
            <p className="text-muted-foreground">{duplicate.phone}</p>
          </div>
          <div className="rounded-md border border-success-500/40 bg-success-500/5 p-3">
            <p className="text-sm text-muted-foreground">Survivor (kept)</p>
            <p className="font-medium">{survivor.fullName}</p>
            <p className="text-muted-foreground">{survivor.phone}</p>
          </div>
        </div>
        <p className="text-muted-foreground">
          Bookings, addresses, invoices, payments, tickets, appliances, AMC subscriptions, ledger
          entries, ratings and loyalty move to the survivor. The duplicate is marked as merged and
          hidden from lists.
        </p>
        <Field label='Type "MERGE" to confirm'>
          <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <ModalFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={confirm !== 'MERGE' || merge.isPending}
            onClick={onMerge}
          >
            {merge.isPending ? 'Merging…' : 'Merge'}
          </Button>
        </ModalFooter>
      </div>
    </SimpleModal>
  );
}
