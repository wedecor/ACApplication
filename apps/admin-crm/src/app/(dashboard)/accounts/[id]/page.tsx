'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ac/ui';
import { ArrowLeft, Pencil, Plus, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { StatCard } from '@/components/common/form-field';
import { ACCOUNT_TYPE_LABEL, AccountFormModal } from '@/components/sales/account-form-modal';
import { CustomerPicker } from '@/components/sales/customer-picker';
import { OpportunityFormModal } from '@/components/sales/opportunity-form-modal';
import {
  useAccount,
  useDeleteAccount,
  useLinkAccountCustomers,
  useUnlinkAccountCustomer,
} from '@/hooks/use-sales';
import { errorMessage, formatDate, formatINR } from '@/lib/crm-format';

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: account, isLoading, error } = useAccount(id);
  const link = useLinkAccountCustomers(id);
  const unlink = useUnlinkAccountCustomer(id);
  const del = useDeleteAccount();
  const [editOpen, setEditOpen] = React.useState(false);
  const [oppOpen, setOppOpen] = React.useState(false);

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (error || !account) {
    return (
      <div className="space-y-2">
        <Link
        href="/accounts"
        className="-ml-2 inline-flex h-10 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Accounts
      </Link>
        <p className="text-sm text-destructive">{errorMessage(error, 'Account not found')}</p>
      </div>
    );
  }

  const onLink = async (customerId: string) => {
    try {
      await link.mutateAsync([customerId]);
      toast.success('Customer linked');
    } catch (err) {
      toast.error(errorMessage(err, 'Link failed'));
    }
  };

  const onUnlink = async (customerId: string) => {
    try {
      await unlink.mutateAsync(customerId);
      toast.success('Customer unlinked');
    } catch (err) {
      toast.error(errorMessage(err, 'Unlink failed'));
    }
  };

  const onDelete = async () => {
    if (!window.confirm(`Delete account ${account.name}? Linked customers are kept but unlinked.`)) return;
    try {
      await del.mutateAsync(account.id);
      toast.success('Account deleted');
      router.push('/accounts');
    } catch (err) {
      toast.error(errorMessage(err, 'Delete failed'));
    }
  };

  const s = account.stats;

  return (
    <div className="space-y-6">
      <Link
        href="/accounts"
        className="-ml-2 inline-flex h-10 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Accounts
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{account.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {ACCOUNT_TYPE_LABEL[account.type] ?? account.type}
            {account.gstin ? ` · GSTIN ${account.gstin}` : ''}
            {account.phone ? ` · ${account.phone}` : ''}
            {account.billingEmail ? ` · ${account.billingEmail}` : ''}
          </p>
          {account.addressLine ? <p className="text-sm text-muted-foreground">{account.addressLine}</p> : null}
          <div className="mt-2 flex flex-wrap gap-1">
            {account.tags.map((t) => (
              <Badge key={t} variant="outline">
                {t}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-1 size-4" /> Edit
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete}>
            <Trash2 className="mr-1 size-4" /> Delete
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Customers" value={s.customerCount} />
        <StatCard label="Bookings" value={s.bookingCount} />
        <StatCard label="Completed" value={s.completedBookingCount} />
        <StatCard label="Active AMC" value={s.activeAmcCount} />
        <StatCard label="Revenue" value={formatINR(s.revenueMinor)} />
        <StatCard label="Outstanding" value={formatINR(s.outstandingMinor)} />
      </div>

      {account.notes ? (
        <Card>
          <CardContent className="whitespace-pre-wrap pt-6 text-sm text-muted-foreground">{account.notes}</CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Customers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="max-w-md">
            <CustomerPicker
              placeholder="Link a customer — search name or phone…"
              excludeIds={account.customers.map((c) => c.id)}
              onPick={(c) => void onLink(c.id)}
            />
          </div>
          {account.customers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No customers linked yet.</p>
          ) : (
            <Table stackOnMobile>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Bookings</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {account.customers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link href={`/customers/${c.id}`} className="text-primary hover:underline">
                        {c.fullName}
                      </Link>
                    </TableCell>
                    <TableCell>{c.phone}</TableCell>
                    <TableCell>{c.email ?? '—'}</TableCell>
                    <TableCell>{c.totalBookings}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => void onUnlink(c.id)} aria-label="Unlink">
                        <X className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent bookings</CardTitle>
          </CardHeader>
          <CardContent>
            {account.recentBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bookings.</p>
            ) : (
              <ul className="divide-y text-sm">
                {account.recentBookings.map((b) => (
                  <li key={b.id} className="flex justify-between gap-2 py-2">
                    <div>
                      <Link href={`/bookings/${b.id}`} className="font-medium text-primary hover:underline">
                        {b.code}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {b.customerName} · {b.category.replace(/_/g, ' ')} · {formatDate(b.scheduledAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary">{b.status}</Badge>
                      {b.finalAmountMinor !== null ? (
                        <p className="text-xs tabular-nums">{formatINR(b.finalAmountMinor)}</p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AMC subscriptions</CardTitle>
          </CardHeader>
          <CardContent>
            {account.amcSubscriptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No AMC subscriptions.</p>
            ) : (
              <ul className="divide-y text-sm">
                {account.amcSubscriptions.map((a) => (
                  <li key={a.id} className="flex justify-between gap-2 py-2">
                    <div>
                      <span className="font-medium">{a.number}</span>
                      <p className="text-xs text-muted-foreground">
                        {a.planName} · ends {formatDate(a.endsAt)}
                      </p>
                    </div>
                    <Badge variant={a.status === 'ACTIVE' ? 'success' : 'muted'}>{a.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Opportunities</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setOppOpen(true)}>
            <Plus className="mr-1 size-4" /> New
          </Button>
        </CardHeader>
        <CardContent>
          {account.opportunities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No opportunities.</p>
          ) : (
            <ul className="divide-y text-sm">
              {account.opportunities.map((o) => (
                <li key={o.id} className="flex justify-between py-2">
                  <span>{o.title}</span>
                  <span className="flex items-center gap-2">
                    <Badge variant="secondary">{o.stage}</Badge>
                    <span className="tabular-nums">{formatINR(o.valueMinor)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AccountFormModal open={editOpen} onOpenChange={setEditOpen} account={account} />
      <OpportunityFormModal
        open={oppOpen}
        onOpenChange={setOppOpen}
        defaults={{ accountId: account.id, title: `${account.name} — ` }}
      />
    </div>
  );
}
