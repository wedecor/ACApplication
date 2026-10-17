'use client';

import { Permission } from '@ac/types';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Skeleton } from '@ac/ui';
import * as React from 'react';
import { toast } from 'sonner';

import {
  useDeleteCommissionRule,
  useTechnicianCommissionRule,
  useUpsertCommissionRule,
} from '@/hooks/use-technicians';
import { apiErrorMessage } from '@/lib/api/error-message';
import type { CommissionType, PayoutCycle, UpsertCommissionRuleInput } from '@/lib/api/technicians';
import { formatMinor } from '@/lib/format';
import { hasPermission, readSessionClaims } from '@/lib/rbac/permissions';

const TYPES: CommissionType[] = ['PERCENTAGE', 'FLAT', 'PER_JOB'];
const CYCLES: PayoutCycle[] = ['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'ON_DEMAND'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Rupees ↔ minor units helpers for form inputs. */
const toMajor = (minor: number) => String(minor / 100);
const toMinor = (major: string) => Math.round((Number(major) || 0) * 100);

interface FormState {
  type: CommissionType;
  value: string;
  bonus: string;
  penalty: string;
  minPayout: string;
  payoutCycle: PayoutCycle;
  cycleClosesOn: number;
}

const DEFAULT_FORM: FormState = {
  type: 'PERCENTAGE',
  value: '40',
  bonus: '0',
  penalty: '0',
  minPayout: '0',
  payoutCycle: 'WEEKLY',
  cycleClosesOn: 6,
};

export function CommissionRuleCard({ technicianId }: { technicianId: string }) {
  const { permissions } = readSessionClaims();
  const canView = hasPermission(Permission.PAYOUT_VIEW, permissions);
  const canEdit = hasPermission(Permission.PAYOUT_APPROVE, permissions);
  const { data, isLoading, error } = useTechnicianCommissionRule(technicianId, canView);
  const upsert = useUpsertCommissionRule(technicianId);
  const remove = useDeleteCommissionRule(technicianId);
  const [editing, setEditing] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(DEFAULT_FORM);

  React.useEffect(() => {
    const r = data?.rule;
    if (!r) return setForm(DEFAULT_FORM);
    setForm({
      type: r.type,
      value: r.type === 'PERCENTAGE' ? String(r.valueMinor / 100) : toMajor(r.valueMinor),
      bonus: toMajor(r.bonusMinor),
      penalty: toMajor(r.penaltyPerLateMinuteMinor),
      minPayout: toMajor(r.minPayoutMinor),
      payoutCycle: r.payoutCycle,
      cycleClosesOn: r.cycleClosesOn,
    });
  }, [data]);

  if (!canView) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: UpsertCommissionRuleInput = {
      type: form.type,
      // PERCENTAGE is stored in basis points: 40% → 4000.
      valueMinor: form.type === 'PERCENTAGE' ? Math.round((Number(form.value) || 0) * 100) : toMinor(form.value),
      bonusMinor: toMinor(form.bonus),
      penaltyPerLateMinuteMinor: toMinor(form.penalty),
      minPayoutMinor: toMinor(form.minPayout),
      payoutCycle: form.payoutCycle,
      cycleClosesOn: form.cycleClosesOn,
    };
    try {
      await upsert.mutateAsync(payload);
      toast.success('Commission rule saved');
      setEditing(false);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to save commission rule'));
    }
  };

  const reset = async () => {
    try {
      await remove.mutateAsync();
      toast.success('Reverted to the default commission rule');
      setEditing(false);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to remove rule'));
    }
  };

  const rule = data?.rule;
  const describe = () => {
    if (!rule) return 'Default rule: 40% of the booking value';
    const base =
      rule.type === 'PERCENTAGE'
        ? `${rule.valueMinor / 100}% of the booking value`
        : `${formatMinor(rule.valueMinor)} ${rule.type === 'FLAT' ? 'flat' : 'per job'}`;
    return `${base}${rule.bonusMinor ? ` + ${formatMinor(rule.bonusMinor)} bonus` : ''}`;
  };

  const selectCls = 'h-9 w-full rounded-md border bg-background px-2 text-sm';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Commission rule</CardTitle>
        {canEdit && !editing && data ? (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            {rule ? 'Edit' : 'Set custom rule'}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : error ? (
          <p className="text-sm text-muted-foreground">{apiErrorMessage(error)}</p>
        ) : !editing ? (
          <dl className="space-y-1 text-sm">
            <p className="font-medium">{describe()}</p>
            {rule ? (
              <>
                <Row label="Late penalty / min" value={formatMinor(rule.penaltyPerLateMinuteMinor)} />
                <Row label="Min payout" value={formatMinor(rule.minPayoutMinor)} />
                <Row label="Payout cycle" value={`${rule.payoutCycle} (closes ${DAYS[rule.cycleClosesOn]})`} />
              </>
            ) : (
              <p className="text-xs text-muted-foreground">No custom rule — the payouts engine default applies.</p>
            )}
          </dl>
        ) : (
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="commission-rule-card-type" className="mb-1 block text-xs">Type</Label>
              <select id="commission-rule-card-type"
                className={selectCls}
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as CommissionType })}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="mb-1 block text-xs">{form.type === 'PERCENTAGE' ? 'Percent (%)' : 'Amount (₹)'}</Label>
              <Input
                type="number"
                min={0}
                max={form.type === 'PERCENTAGE' ? 100 : undefined}
                step="0.01"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="commission-rule-card-bonus-per-job" className="mb-1 block text-xs">Bonus per job (₹)</Label>
              <Input id="commission-rule-card-bonus-per-job" type="number" min={0} step="0.01" value={form.bonus} onChange={(e) => setForm({ ...form, bonus: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="commission-rule-card-late-penalty-per-minute" className="mb-1 block text-xs">Late penalty per minute (₹)</Label>
              <Input id="commission-rule-card-late-penalty-per-minute" type="number" min={0} step="0.01" value={form.penalty} onChange={(e) => setForm({ ...form, penalty: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="commission-rule-card-min-payout" className="mb-1 block text-xs">Min payout (₹)</Label>
              <Input id="commission-rule-card-min-payout" type="number" min={0} step="0.01" value={form.minPayout} onChange={(e) => setForm({ ...form, minPayout: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="commission-rule-card-payout-cycle" className="mb-1 block text-xs">Payout cycle</Label>
              <select id="commission-rule-card-payout-cycle"
                className={selectCls}
                value={form.payoutCycle}
                onChange={(e) => setForm({ ...form, payoutCycle: e.target.value as PayoutCycle })}
              >
                {CYCLES.map((c) => (
                  <option key={c} value={c}>
                    {c.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="commission-rule-card-cycle-closes-on" className="mb-1 block text-xs">Cycle closes on</Label>
              <select id="commission-rule-card-cycle-closes-on"
                className={selectCls}
                value={form.cycleClosesOn}
                onChange={(e) => setForm({ ...form, cycleClosesOn: Number(e.target.value) })}
              >
                {DAYS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end justify-end gap-2 sm:col-span-2">
              {rule ? (
                <Button type="button" variant="ghost" disabled={remove.isPending} onClick={() => void reset()}>
                  Use default
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={upsert.isPending}>
                {upsert.isPending ? 'Saving…' : 'Save rule'}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 text-xs">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
