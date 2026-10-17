'use client';

import { Permission } from '@ac/types';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from '@ac/ui';
import { Gift, Pencil, Tag } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';

import { useCustomFieldDefinitions } from '@/hooks/use-custom-fields';
import { useAdjustLoyalty, useLoyalty } from '@/hooks/use-growth';
import type { CustomerDetail } from '@/lib/api/customers';
import { errorMessage, formatDate } from '@/lib/crm-format';
import { hasPermission, readSessionClaims } from '@/lib/rbac/permissions';

import { formatCustomFieldValue } from './custom-field-inputs';
import { CustomerDuplicatesPanel } from './customer-duplicates-panel';
import { CustomerFormModal } from './customer-form-modal';

/** Edit button for the customer detail header. */
export function CustomerEditButton({ customer }: { customer: CustomerDetail }) {
  const [open, setOpen] = React.useState(false);
  const canWrite = hasPermission(Permission.CUSTOMER_WRITE, readSessionClaims().permissions);
  if (!canWrite) return null;
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Pencil className="mr-1 size-4" /> Edit
      </Button>
      <CustomerFormModal open={open} onOpenChange={setOpen} customer={customer} />
    </>
  );
}

/** Tags, account, language, custom fields, loyalty and duplicates for a customer. */
export function CustomerCrmPanel({ customer }: { customer: CustomerDetail }) {
  const { data: defs = [] } = useCustomFieldDefinitions('customer');
  const claims = readSessionClaims();
  const canSeeMarketing = hasPermission(Permission.MARKETING_VIEW, claims.permissions);
  const customFields = customer.customFields ?? {};
  const fieldKeys = Array.from(
    new Set([...defs.filter((d) => d.isActive).map((d) => d.key), ...Object.keys(customFields)]),
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Tag className="size-4" /> Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Tags</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {(customer.tags ?? []).length === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  (customer.tags ?? []).map((t) => (
                    <Badge key={t} variant="secondary">
                      {t}
                    </Badge>
                  ))
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Account</p>
                {customer.account ? (
                  <Link href={`/accounts/${customer.account.id}`} className="text-primary hover:underline">
                    {customer.account.name}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Preferred language</p>
                <span>{customer.preferredLanguage ?? 'en'}</span>
              </div>
            </div>
            {fieldKeys.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 border-t pt-3">
                {fieldKeys.map((key) => {
                  const def = defs.find((d) => d.key === key);
                  return (
                    <div key={key}>
                      <p className="text-xs text-muted-foreground">{def?.label ?? key}</p>
                      <span>{formatCustomFieldValue(def, customFields[key])}</span>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </CardContent>
        </Card>
        {canSeeMarketing ? <LoyaltyCard customer={customer} /> : null}
      </div>
      <CustomerDuplicatesPanel customer={customer} />
    </div>
  );
}

function LoyaltyCard({ customer }: { customer: CustomerDetail }) {
  const { data } = useLoyalty(customer.id);
  const adjust = useAdjustLoyalty(customer.id);
  const canManage = hasPermission(Permission.MARKETING_MANAGE, readSessionClaims().permissions);
  const [points, setPoints] = React.useState('');
  const [reason, setReason] = React.useState('');
  const balance = data?.balance ?? customer.loyaltyPoints ?? 0;

  const onAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(points);
    if (!Number.isInteger(n) || n === 0 || !reason.trim()) {
      toast.error('Enter a non-zero whole number of points and a reason');
      return;
    }
    try {
      await adjust.mutateAsync({ points: n, reason: reason.trim() });
      toast.success('Loyalty adjusted');
      setPoints('');
      setReason('');
    } catch (err) {
      toast.error(errorMessage(err, 'Adjustment failed'));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Gift className="size-4" /> Loyalty
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-2xl font-bold tabular-nums">
          {balance.toLocaleString('en-IN')} <span className="text-sm font-normal text-muted-foreground">points</span>
        </p>
        <ul className="max-h-40 space-y-1 overflow-y-auto">
          {(data?.entries ?? []).slice(0, 10).map((e) => (
            <li key={e.id} className="flex justify-between gap-2">
              <span className="truncate">{e.reason}</span>
              <span className={e.points >= 0 ? 'text-success-600' : 'text-destructive'}>
                {e.points > 0 ? '+' : ''}
                {e.points} · {formatDate(e.createdAt)}
              </span>
            </li>
          ))}
        </ul>
        {canManage ? (
          <form onSubmit={onAdjust} className="flex gap-2 border-t pt-3">
            <Input
              className="w-24"
              type="number"
              placeholder="±pts"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
            />
            <Input placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
            <Button type="submit" size="sm" disabled={adjust.isPending}>
              Adjust
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
