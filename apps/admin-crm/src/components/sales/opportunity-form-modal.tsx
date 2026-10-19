'use client';

import { Button, Input, ModalFooter } from '@ac/ui';
import * as React from 'react';
import { toast } from 'sonner';

import { Field, NativeSelect, TextArea } from '@/components/common/form-field';
import { SimpleModal } from '@/components/common/simple-modal';
import { useAccounts, useSaveOpportunity } from '@/hooks/use-sales';
import {
  DEFAULT_STAGE_PROBABILITY,
  type Opportunity,
  OPPORTUNITY_STAGES,
  type OpportunityInput,
  type OpportunityStage,
} from '@/lib/api/sales';
import { errorMessage, minorToRupees, rupeesToMinor } from '@/lib/crm-format';

export function OpportunityFormModal({
  open,
  onOpenChange,
  opportunity,
  defaults,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  opportunity?: Opportunity | null;
  defaults?: Partial<OpportunityInput>;
}) {
  const save = useSaveOpportunity();
  const { data: accounts } = useAccounts({ pageSize: 100 });
  const isEdit = Boolean(opportunity);
  const [f, setF] = React.useState({
    title: '',
    accountId: '',
    customerId: '',
    stage: 'NEW' as OpportunityStage,
    value: '',
    probabilityPct: '10',
    expectedCloseAt: '',
    notes: '',
  });

  // Callers often pass `defaults` inline — key the reset on its contents, not identity.
  const defaultsKey = JSON.stringify(defaults ?? {});
  React.useEffect(() => {
    if (!open) return;
    const stage = opportunity?.stage ?? defaults?.stage ?? 'NEW';
    setF({
      title: opportunity?.title ?? defaults?.title ?? '',
      accountId: opportunity?.accountId ?? defaults?.accountId ?? '',
      customerId: opportunity?.customerId ?? defaults?.customerId ?? '',
      stage,
      value: minorToRupees(opportunity?.valueMinor ?? defaults?.valueMinor ?? null),
      probabilityPct: String(opportunity?.probabilityPct ?? DEFAULT_STAGE_PROBABILITY[stage]),
      expectedCloseAt: (opportunity?.expectedCloseAt ?? defaults?.expectedCloseAt ?? '').slice(0, 10),
      notes: opportunity?.notes ?? '',
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, opportunity, defaultsKey]);

  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input: OpportunityInput = {
      title: f.title.trim(),
      accountId: f.accountId || undefined,
      customerId: f.customerId || undefined,
      valueMinor: rupeesToMinor(f.value),
      probabilityPct: Math.min(100, Math.max(0, Number(f.probabilityPct) || 0)),
      expectedCloseAt: f.expectedCloseAt ? new Date(f.expectedCloseAt).toISOString() : undefined,
      notes: f.notes.trim() || undefined,
      ...(isEdit ? {} : { stage: f.stage, leadId: defaults?.leadId }),
    };
    try {
      await save.mutateAsync({ id: opportunity?.id, input });
      toast.success(isEdit ? 'Opportunity updated' : 'Opportunity created');
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to save opportunity'));
    }
  };

  return (
    <SimpleModal
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Edit opportunity' : 'New opportunity'}
      className="max-w-2xl"
    >
      <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
        <Field label="Title *" className="col-span-2">
          <Input required value={f.title} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <Field label="Account">
          <NativeSelect value={f.accountId} onChange={(e) => set('accountId', e.target.value)}>
            <option value="">— None —</option>
            {(accounts?.items ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {!isEdit ? (
          <Field label="Stage">
            <NativeSelect
              value={f.stage}
              onChange={(e) => {
                const s = e.target.value as OpportunityStage;
                setF((x) => ({ ...x, stage: s, probabilityPct: String(DEFAULT_STAGE_PROBABILITY[s]) }));
              }}
            >
              {OPPORTUNITY_STAGES.filter((s) => s !== 'WON' && s !== 'LOST').map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </NativeSelect>
          </Field>
        ) : (
          <div />
        )}
        <Field label="Value (₹)">
          <Input type="number" min="0" step="1" value={f.value} onChange={(e) => set('value', e.target.value)} />
        </Field>
        <Field label="Probability (%)">
          <Input
            type="number"
            min="0"
            max="100"
            value={f.probabilityPct}
            onChange={(e) => set('probabilityPct', e.target.value)}
          />
        </Field>
        <Field label="Expected close">
          <Input type="date" value={f.expectedCloseAt} onChange={(e) => set('expectedCloseAt', e.target.value)} />
        </Field>
        <Field label="Customer id (optional)">
          <Input value={f.customerId} onChange={(e) => set('customerId', e.target.value)} />
        </Field>
        <Field label="Notes" className="col-span-2">
          <TextArea rows={3} value={f.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
        <ModalFooter className="col-span-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            Save
          </Button>
        </ModalFooter>
      </form>
    </SimpleModal>
  );
}
