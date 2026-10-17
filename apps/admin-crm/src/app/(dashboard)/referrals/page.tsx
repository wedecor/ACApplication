'use client';

import {
  Badge,
  Button,
  EmptyState,
  Input,
  ModalFooter,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ac/ui';
import { Share2 } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';

import { Field, NativeSelect, StatCard } from '@/components/common/form-field';
import { Pagination } from '@/components/common/pagination';
import { SimpleModal } from '@/components/common/simple-modal';
import { useOverrideReferral, useReferrals, useReferralStats } from '@/hooks/use-growth';
import type { ReferralListQuery, ReferralRow, ReferralStatus } from '@/lib/api/growth';
import { errorMessage, formatDate, formatINR, minorToRupees, rupeesToMinor } from '@/lib/crm-format';

const STATUSES: ReferralStatus[] = ['PENDING', 'QUALIFIED', 'REWARDED', 'REJECTED'];
const STATUS_VARIANT: Record<ReferralStatus, 'muted' | 'info' | 'success' | 'destructive'> = {
  PENDING: 'muted',
  QUALIFIED: 'info',
  REWARDED: 'success',
  REJECTED: 'destructive',
};

export default function ReferralsPage() {
  const [query, setQuery] = React.useState<ReferralListQuery>({ page: 1, pageSize: 20 });
  const [draft, setDraft] = React.useState('');
  const { data, isLoading, error } = useReferrals(query);
  const { data: stats } = useReferralStats();
  const [editing, setEditing] = React.useState<ReferralRow | null>(null);
  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Referrals</h1>
        <p className="text-sm text-muted-foreground">
          Customer-to-customer referrals. Rewards are credited when the referred customer completes their first booking.
        </p>
      </header>

      {stats ? (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Total" value={stats.total} />
          <StatCard label="Pending" value={stats.pending} />
          <StatCard label="Qualified" value={stats.qualified} />
          <StatCard label="Rewarded" value={stats.rewarded} />
          <StatCard label="Rejected" value={stats.rejected} />
          <StatCard label="Rewards paid" value={formatINR(stats.totalRewardMinor)} />
        </div>
      ) : null}

      <form
        className="flex max-w-xl gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery((q) => ({ ...q, page: 1, search: draft.trim() || undefined }));
        }}
      >
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Search name, phone or code…" />
        <NativeSelect
          className="w-40"
          value={query.status ?? ''}
          onChange={(e) =>
            setQuery((q) => ({ ...q, page: 1, status: (e.target.value || undefined) as ReferralStatus | undefined }))
          }
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {error ? (
        <p className="text-sm text-destructive">{errorMessage(error, 'Failed to load referrals')}</p>
      ) : isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : items.length === 0 ? (
        <EmptyState icon={Share2} title="No referrals" description="Referrals appear when customers apply a friend's code." />
      ) : (
        <>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referrer</TableHead>
                  <TableHead>Referred</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reward</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <PersonLink p={r.referrer} />
                    </TableCell>
                    <TableCell>
                      <PersonLink p={r.referred} />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.code}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge>
                      {r.rewardedAt ? (
                        <p className="text-xs text-muted-foreground">{formatDate(r.rewardedAt)}</p>
                      ) : r.qualifiedAt ? (
                        <p className="text-xs text-muted-foreground">{formatDate(r.qualifiedAt)}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="tabular-nums">{formatINR(r.rewardMinor)}</TableCell>
                    <TableCell className="text-xs">{formatDate(r.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>
                        Override
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {data?.pagination ? (
            <Pagination {...data.pagination} onPageChange={(page) => setQuery((q) => ({ ...q, page }))} />
          ) : null}
        </>
      )}
      <OverrideModal referral={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function PersonLink({ p }: { p: ReferralRow['referrer'] }) {
  if (!p) return <span className="text-muted-foreground">—</span>;
  return (
    <div>
      <Link href={`/customers/${p.id}`} className="font-medium text-primary hover:underline">
        {p.fullName}
      </Link>
      <p className="text-xs text-muted-foreground">{p.phone}</p>
    </div>
  );
}

function OverrideModal({ referral, onClose }: { referral: ReferralRow | null; onClose: () => void }) {
  const override = useOverrideReferral();
  const [status, setStatus] = React.useState<ReferralStatus>('PENDING');
  const [reward, setReward] = React.useState('');
  React.useEffect(() => {
    if (referral) {
      setStatus(referral.status);
      setReward(referral.rewardMinor ? minorToRupees(referral.rewardMinor) : '');
    }
  }, [referral]);
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!referral) return;
    try {
      await override.mutateAsync({
        id: referral.id,
        status,
        rewardMinor: reward ? rupeesToMinor(reward) : undefined,
      });
      toast.success('Referral updated');
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  return (
    <SimpleModal
      open={Boolean(referral)}
      onOpenChange={(o) => !o && onClose()}
      title="Override referral"
      description="Setting REWARDED credits the reward to the referrer if not already credited."
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Status">
          <NativeSelect value={status} onChange={(e) => setStatus(e.target.value as ReferralStatus)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Reward (₹)" hint="Leave blank to use the configured default">
          <Input type="number" min="0" value={reward} onChange={(e) => setReward(e.target.value)} />
        </Field>
        <ModalFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={override.isPending}>
            Save
          </Button>
        </ModalFooter>
      </form>
    </SimpleModal>
  );
}
