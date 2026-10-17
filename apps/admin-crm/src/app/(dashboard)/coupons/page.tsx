'use client';

import {
  Badge,
  Button,
  EmptyState,
  Input,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ac/ui';
import { Plus, TicketPercent } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';

import { NativeSelect } from '@/components/common/form-field';
import { Pagination } from '@/components/common/pagination';
import { SimpleModal } from '@/components/common/simple-modal';
import { CouponFormModal, couponValueLabel } from '@/components/growth/coupon-form-modal';
import { useCouponRedemptions, useCoupons, useToggleCoupon } from '@/hooks/use-growth';
import type { Coupon, CouponListQuery } from '@/lib/api/growth';
import { errorMessage, formatDate, formatDateTime, formatINR } from '@/lib/crm-format';

function couponState(c: Coupon): { label: string; variant: 'success' | 'muted' | 'warning' | 'destructive' } {
  const now = Date.now();
  if (!c.isActive) return { label: 'Inactive', variant: 'muted' };
  if (c.validUntil && new Date(c.validUntil).getTime() < now) return { label: 'Expired', variant: 'destructive' };
  if (new Date(c.validFrom).getTime() > now) return { label: 'Upcoming', variant: 'warning' };
  if (c.usageLimit !== null && c.usedCount >= c.usageLimit) return { label: 'Exhausted', variant: 'destructive' };
  return { label: 'Live', variant: 'success' };
}

export default function CouponsPage() {
  const [query, setQuery] = React.useState<CouponListQuery>({ page: 1, pageSize: 20 });
  const [draft, setDraft] = React.useState('');
  const { data, isLoading, error } = useCoupons(query);
  const toggle = useToggleCoupon();
  const [editing, setEditing] = React.useState<Coupon | 'new' | null>(null);
  const [viewing, setViewing] = React.useState<Coupon | null>(null);
  const items = data?.items ?? [];

  const onToggle = async (c: Coupon) => {
    try {
      await toggle.mutateAsync({ id: c.id, isActive: !c.isActive });
      toast.success(c.isActive ? 'Coupon deactivated' : 'Coupon activated');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Coupons</h1>
          <p className="text-sm text-muted-foreground">Discount codes applied to bookings at invoice time.</p>
        </div>
        <Button size="sm" onClick={() => setEditing('new')}>
          <Plus className="mr-1 size-4" /> New coupon
        </Button>
      </header>

      <form
        className="flex max-w-xl gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery((q) => ({ ...q, page: 1, search: draft.trim() || undefined }));
        }}
      >
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Search code or description…" />
        <NativeSelect
          className="w-40"
          value={query.isActive === undefined ? '' : String(query.isActive)}
          onChange={(e) =>
            setQuery((q) => ({ ...q, page: 1, isActive: e.target.value === '' ? undefined : e.target.value === 'true' }))
          }
        >
          <option value="">All</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </NativeSelect>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {error ? (
        <p className="text-sm text-destructive">{errorMessage(error, 'Failed to load coupons')}</p>
      ) : isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : items.length === 0 ? (
        <EmptyState icon={TicketPercent} title="No coupons" description="Create a coupon to run a promotion." />
      ) : (
        <>
          <div className="rounded-lg border">
            <Table stackOnMobile>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Rules</TableHead>
                  <TableHead>Validity</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((c) => {
                  const st = couponState(c);
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <span className="font-mono font-semibold">{c.code}</span>
                        {c.description ? <p className="text-xs text-muted-foreground">{c.description}</p> : null}
                      </TableCell>
                      <TableCell className="text-sm">{couponValueLabel(c)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {c.minOrderMinor > 0 ? <p>Min {formatINR(c.minOrderMinor)}</p> : null}
                        {c.firstBookingOnly ? <p>First booking only</p> : null}
                        <p>{c.categories.length ? c.categories.join(', ').replace(/_/g, ' ') : 'All categories'}</p>
                        <p>{c.perCustomerLimit}/customer</p>
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatDate(c.validFrom)} → {c.validUntil ? formatDate(c.validUntil) : 'no end'}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {c.usedCount}
                        {c.usageLimit !== null ? ` / ${c.usageLimit}` : ''}
                      </TableCell>
                      <TableCell>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setViewing(c)}>
                            Redemptions
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => void onToggle(c)}>
                            {c.isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {data?.pagination ? (
            <Pagination {...data.pagination} onPageChange={(page) => setQuery((q) => ({ ...q, page }))} />
          ) : null}
        </>
      )}

      <CouponFormModal
        open={Boolean(editing)}
        onOpenChange={(o) => !o && setEditing(null)}
        coupon={editing === 'new' ? null : editing}
      />
      <RedemptionsModal coupon={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

function RedemptionsModal({ coupon, onClose }: { coupon: Coupon | null; onClose: () => void }) {
  const [page, setPage] = React.useState(1);
  React.useEffect(() => setPage(1), [coupon]);
  const { data, isLoading } = useCouponRedemptions(coupon?.id ?? null, page);
  return (
    <SimpleModal
      open={Boolean(coupon)}
      onOpenChange={(o) => !o && onClose()}
      title={`Redemptions — ${coupon?.code ?? ''}`}
      className="max-w-2xl"
    >
      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : (data?.items ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">No redemptions yet.</p>
      ) : (
        <>
          <Table stackOnMobile>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Booking</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.items ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={`/customers/${r.customerId}`} className="text-primary hover:underline">
                      {r.customer?.fullName ?? r.customerId}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {r.bookingId ? (
                      <Link href={`/bookings/${r.bookingId}`} className="text-primary hover:underline">
                        View
                      </Link>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">{formatINR(r.discountMinor)}</TableCell>
                  <TableCell className="text-xs">{formatDateTime(r.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {data?.pagination ? <Pagination {...data.pagination} onPageChange={setPage} /> : null}
        </>
      )}
    </SimpleModal>
  );
}
