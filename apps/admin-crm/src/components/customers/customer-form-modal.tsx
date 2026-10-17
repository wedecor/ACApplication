'use client';

import { Button, Input, ModalFooter } from '@ac/ui';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';

import { Field, NativeSelect } from '@/components/common/form-field';
import { SimpleModal } from '@/components/common/simple-modal';
import { useCustomFieldDefinitions } from '@/hooks/use-custom-fields';
import { useDuplicateCheck, useSaveCustomer } from '@/hooks/use-customers';
import { useAccounts } from '@/hooks/use-sales';
import type { CustomerDetail, CustomerInput } from '@/lib/api/customers';
import { errorMessage, splitTags } from '@/lib/crm-format';

import { CustomFieldInputs } from './custom-field-inputs';

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'kn', label: 'Kannada' },
  { value: 'ta', label: 'Tamil' },
  { value: 'te', label: 'Telugu' },
  { value: 'ml', label: 'Malayalam' },
  { value: 'mr', label: 'Marathi' },
  { value: 'bn', label: 'Bengali' },
];

interface FormState {
  fullName: string;
  phone: string;
  email: string;
  accountId: string;
  tags: string;
  preferredLanguage: string;
  customFields: Record<string, unknown>;
}

function initialState(customer?: CustomerDetail | null): FormState {
  return {
    fullName: customer?.fullName ?? '',
    phone: customer?.phone ?? '',
    email: customer?.email ?? '',
    accountId: customer?.accountId ?? '',
    tags: (customer?.tags ?? []).join(', '),
    preferredLanguage: customer?.preferredLanguage ?? 'en',
    customFields: { ...(customer?.customFields ?? {}) },
  };
}

/** Create / edit customer dialog with tags, custom fields, account link and duplicate warning. */
export function CustomerFormModal({
  open,
  onOpenChange,
  customer,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer?: CustomerDetail | null;
  onSaved?: (customer: CustomerDetail) => void;
}) {
  const isEdit = Boolean(customer);
  const [form, setForm] = React.useState<FormState>(() => initialState(customer));
  const save = useSaveCustomer();
  const { data: defs = [] } = useCustomFieldDefinitions('customer');
  const { data: accounts } = useAccounts({ pageSize: 100 });

  React.useEffect(() => {
    if (open) setForm(initialState(customer));
  }, [open, customer]);

  // Debounced duplicate check (create mode only).
  const [dupQuery, setDupQuery] = React.useState<{ phone?: string; email?: string; fullName?: string }>({});
  React.useEffect(() => {
    if (isEdit || !open) return;
    const t = setTimeout(
      () =>
        setDupQuery({
          phone: form.phone.trim().length >= 8 ? form.phone.trim() : undefined,
          email: form.email.trim() || undefined,
          fullName: form.fullName.trim().length >= 3 ? form.fullName.trim() : undefined,
        }),
      400,
    );
    return () => clearTimeout(t);
  }, [form.phone, form.email, form.fullName, isEdit, open]);
  const dupEnabled = !isEdit && open && Boolean(dupQuery.phone || dupQuery.email || dupQuery.fullName);
  const { data: dupData } = useDuplicateCheck(dupQuery, dupEnabled);
  const duplicates = dupEnabled ? (dupData?.items ?? []) : [];

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName.trim() || !form.phone.trim()) {
      toast.error('Name and phone are required');
      return;
    }
    const input: CustomerInput = {
      fullName: form.fullName.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      accountId: form.accountId || null,
      tags: splitTags(form.tags),
      preferredLanguage: form.preferredLanguage,
      customFields: form.customFields,
    };
    try {
      const saved = await save.mutateAsync({ id: customer?.id, input });
      toast.success(isEdit ? 'Customer updated' : 'Customer created');
      onOpenChange(false);
      onSaved?.(saved);
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to save customer'));
    }
  };

  return (
    <SimpleModal
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Edit customer' : 'New customer'}
      description="Contact details, segmentation tags and tenant-defined custom fields."
      className="max-w-2xl"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Full name *">
            <Input value={form.fullName} onChange={(e) => set('fullName', e.target.value)} />
          </Field>
          <Field label="Phone *" hint="Normalised to E.164 (+91…) by the API">
            <Input
              value={form.phone}
              placeholder="+919876543210"
              onChange={(e) => set('phone', e.target.value)}
            />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </Field>
          <Field label="Preferred language">
            <NativeSelect
              value={form.preferredLanguage}
              onChange={(e) => set('preferredLanguage', e.target.value)}
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="B2B account">
            <NativeSelect value={form.accountId} onChange={(e) => set('accountId', e.target.value)}>
              <option value="">— None —</option>
              {(accounts?.items ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Tags (comma-separated)">
            <Input
              value={form.tags}
              placeholder="vip, society, repeat"
              onChange={(e) => set('tags', e.target.value)}
            />
          </Field>
        </div>

        {defs.length > 0 ? (
          <div className="space-y-2 border-t pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Custom fields
            </p>
            <CustomFieldInputs
              definitions={defs}
              values={form.customFields}
              onChange={(v) => set('customFields', v)}
            />
          </div>
        ) : null}

        {duplicates.length > 0 ? (
          <div className="rounded-md border border-warning-500/50 bg-warning-500/10 p-3 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <AlertTriangle className="size-4" /> Possible duplicates
            </p>
            <ul className="mt-2 space-y-1">
              {duplicates.slice(0, 5).map((d) => (
                <li key={d.customer.id} className="flex justify-between gap-2">
                  <Link
                    href={`/customers/${d.customer.id}`}
                    className="text-primary hover:underline"
                    target="_blank"
                  >
                    {d.customer.fullName} · {d.customer.phone}
                  </Link>
                  <span className="text-xs text-muted-foreground">{d.reasons.join(', ')}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <ModalFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create customer'}
          </Button>
        </ModalFooter>
      </form>
    </SimpleModal>
  );
}
