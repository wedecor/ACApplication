'use client';

import { Button, Input, ModalFooter } from '@ac/ui';
import * as React from 'react';
import { toast } from 'sonner';

import { Field, NativeSelect, TextArea } from '@/components/common/form-field';
import { SimpleModal } from '@/components/common/simple-modal';
import { useSaveAccount } from '@/hooks/use-sales';
import { type Account, ACCOUNT_TYPES, type AccountInput, type AccountType } from '@/lib/api/sales';
import { errorMessage, splitTags } from '@/lib/crm-format';

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  RESIDENTIAL_SOCIETY: 'Residential society',
  OFFICE: 'Office',
  RETAIL: 'Retail',
  HOSPITALITY: 'Hospitality',
  BUILDER: 'Builder',
  INSTITUTION: 'Institution',
  OTHER: 'Other',
};

export function AccountFormModal({
  open,
  onOpenChange,
  account,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  account?: Account | null;
  onSaved?: (a: Account) => void;
}) {
  const save = useSaveAccount();
  const [f, setF] = React.useState({
    name: '',
    type: 'OTHER' as AccountType,
    gstin: '',
    billingEmail: '',
    phone: '',
    addressLine: '',
    notes: '',
    tags: '',
  });
  React.useEffect(() => {
    if (!open) return;
    setF({
      name: account?.name ?? '',
      type: account?.type ?? 'OTHER',
      gstin: account?.gstin ?? '',
      billingEmail: account?.billingEmail ?? '',
      phone: account?.phone ?? '',
      addressLine: account?.addressLine ?? '',
      notes: account?.notes ?? '',
      tags: (account?.tags ?? []).join(', '),
    });
  }, [open, account]);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input: AccountInput = {
      name: f.name.trim(),
      type: f.type,
      gstin: f.gstin.trim() || undefined,
      billingEmail: f.billingEmail.trim() || undefined,
      phone: f.phone.trim() || undefined,
      addressLine: f.addressLine.trim() || undefined,
      notes: f.notes.trim() || undefined,
      tags: splitTags(f.tags),
    };
    try {
      const saved = await save.mutateAsync({ id: account?.id, input });
      toast.success(account ? 'Account updated' : 'Account created');
      onOpenChange(false);
      onSaved?.(saved);
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to save account'));
    }
  };

  return (
    <SimpleModal
      open={open}
      onOpenChange={onOpenChange}
      title={account ? 'Edit account' : 'New account'}
      description="B2B customers such as housing societies, offices and builders."
      className="max-w-2xl"
    >
      <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
        <Field label="Name *">
          <Input required value={f.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Type">
          <NativeSelect value={f.type} onChange={(e) => set('type', e.target.value)}>
            {ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>
                {ACCOUNT_TYPE_LABEL[t]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="GSTIN">
          <Input value={f.gstin} onChange={(e) => set('gstin', e.target.value.toUpperCase())} />
        </Field>
        <Field label="Billing email">
          <Input type="email" value={f.billingEmail} onChange={(e) => set('billingEmail', e.target.value)} />
        </Field>
        <Field label="Phone">
          <Input value={f.phone} onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field label="Tags (comma-separated)">
          <Input value={f.tags} onChange={(e) => set('tags', e.target.value)} />
        </Field>
        <Field label="Address" className="col-span-2">
          <Input value={f.addressLine} onChange={(e) => set('addressLine', e.target.value)} />
        </Field>
        <Field label="Notes" className="col-span-2">
          <TextArea rows={3} value={f.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
        <ModalFooter className="col-span-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </ModalFooter>
      </form>
    </SimpleModal>
  );
}
