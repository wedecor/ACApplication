'use client';

import { Permission } from '@ac/types';
import {
  Button,
  EmptyState,
  Input,
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ac/ui';
import { Plus, Search, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { useDebounce } from 'use-debounce';

import { LoadError } from '@/components/common/load-error';
import { Pagination } from '@/components/common/pagination';
import {
  ClaimStatusBadge,
  errorMessage,
  Field,
  NativeSelect,
  Textarea,
  useCan,
} from '@/components/repair/repair-ui';
import { useCreateWarrantyClaim, useWarrantyClaims } from '@/hooks/use-repair';
import { humanize, type WarrantyClaimStatus, type WarrantyClaimType } from '@/lib/api/repair';
import { formatDate, formatMinor } from '@/lib/format';

const STATUSES: (WarrantyClaimStatus | undefined)[] = [
  undefined,
  'OPEN',
  'APPROVED',
  'SUBMITTED_TO_OEM',
  'SETTLED',
  'REJECTED',
  'CLOSED',
];

export default function WarrantyPage() {
  const canManage = useCan(Permission.WARRANTY_MANAGE);
  const [page, setPage] = React.useState(1);
  const [status, setStatus] = React.useState<WarrantyClaimStatus | undefined>();
  const [type, setType] = React.useState<WarrantyClaimType | ''>('');
  const [search, setSearch] = React.useState('');
  const [debounced] = useDebounce(search, 350);
  const [createOpen, setCreateOpen] = React.useState(false);
  React.useEffect(() => setPage(1), [status, type, debounced]);

  const { data, isLoading, error } = useWarrantyClaims({
    page,
    pageSize: 20,
    status,
    type: type || undefined,
    search: debounced || undefined,
  });
  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Warranty claims</h1>
          <p className="text-sm text-muted-foreground">
            Free revisits under our repair guarantee and work billed back to manufacturers.
          </p>
        </div>
        {canManage ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> New claim
          </Button>
        ) : null}
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Claim number, customer or phone"
            className="pl-8"
          />
        </div>
        <NativeSelect
          value={type}
          onChange={(e) => setType(e.target.value as WarrantyClaimType | '')}
          className="w-44"
          aria-label="Claim type"
        >
          <option value="">All types</option>
          <option value="REPAIR_REVISIT">Repair revisit</option>
          <option value="OEM_CLAIM">OEM claim</option>
        </NativeSelect>
        <div className="flex flex-wrap gap-1">
          {STATUSES.map((s) => (
            <Button
              key={s ?? 'ALL'}
              size="sm"
              variant={status === s ? 'default' : 'outline'}
              onClick={() => setStatus(s)}
            >
              {s ? humanize(s) : 'All'}
            </Button>
          ))}
        </div>
      </div>

      {error ? <LoadError label="warranty claims" message={(error).message} /> : null}

      <div className="rounded-md border">
        <Table stackOnMobile>
          <TableHeader>
            <TableRow>
              <TableHead>Claim</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Appliance</TableHead>
              <TableHead>Original job</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Raised</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={8}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <EmptyState icon={ShieldCheck} title="No warranty claims" description="Claims raised from bookings or appliances show up here." />
                </TableCell>
              </TableRow>
            ) : (
              items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link href={`/warranty/${c.id}`} className="font-mono text-xs hover:underline">
                      {c.number}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{humanize(c.type)}</TableCell>
                  <TableCell className="text-sm">{c.customer?.fullName ?? '—'}</TableCell>
                  <TableCell className="text-sm">
                    {c.appliance ? `${c.appliance.brand} ${c.appliance.modelNumber ?? ''}` : '—'}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{c.originalBooking?.code ?? '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.type === 'OEM_CLAIM' ? formatMinor(c.claimAmountMinor) : '—'}
                  </TableCell>
                  <TableCell>
                    <ClaimStatusBadge status={c.status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {data && data.pagination.totalPages > 1 ? (
        <Pagination
          page={data.pagination.page}
          pageSize={data.pagination.pageSize}
          total={data.pagination.total}
          totalPages={data.pagination.totalPages}
          onPageChange={setPage}
        />
      ) : null}

      <CreateClaimModal open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function CreateClaimModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const create = useCreateWarrantyClaim();
  const [form, setForm] = React.useState({
    type: 'REPAIR_REVISIT' as WarrantyClaimType,
    customerId: '',
    applianceId: '',
    originalBookingId: '',
    reason: '',
    description: '',
    oemName: '',
    claimAmount: '',
  });
  const set = (k: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate(
      {
        type: form.type,
        customerId: form.customerId.trim(),
        applianceId: form.applianceId.trim() || undefined,
        originalBookingId: form.originalBookingId.trim() || undefined,
        reason: form.reason.trim(),
        description: form.description.trim() || undefined,
        oemName: form.type === 'OEM_CLAIM' ? form.oemName.trim() || undefined : undefined,
        claimAmountMinor:
          form.type === 'OEM_CLAIM' && form.claimAmount
            ? Math.round(Number(form.claimAmount) * 100)
            : undefined,
      },
      {
        onSuccess: (claim) => {
          toast.success(`Claim ${claim.number} raised`);
          onOpenChange(false);
          router.push(`/warranty/${claim.id}`);
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-xl">
        <ModalHeader>
          <ModalTitle>New warranty claim</ModalTitle>
          <ModalDescription>
            Tip: raising a revisit claim from the booking page fills these ids for you.
          </ModalDescription>
        </ModalHeader>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <Field label="Type" htmlFor="wc-type">
            <NativeSelect id="wc-type" value={form.type} onChange={set('type')}>
              <option value="REPAIR_REVISIT">Repair revisit (our guarantee)</option>
              <option value="OEM_CLAIM">OEM claim (manufacturer)</option>
            </NativeSelect>
          </Field>
          <Field label="Customer ID" htmlFor="wc-customer">
            <Input id="wc-customer" value={form.customerId} onChange={set('customerId')} required />
          </Field>
          <Field label="Original booking ID" htmlFor="wc-booking" hint="Required for revisits unless an appliance is given.">
            <Input id="wc-booking" value={form.originalBookingId} onChange={set('originalBookingId')} />
          </Field>
          <Field label="Appliance ID" htmlFor="wc-appliance">
            <Input id="wc-appliance" value={form.applianceId} onChange={set('applianceId')} />
          </Field>
          {form.type === 'OEM_CLAIM' ? (
            <>
              <Field label="OEM" htmlFor="wc-oem" hint="Defaults to the appliance brand.">
                <Input id="wc-oem" value={form.oemName} onChange={set('oemName')} />
              </Field>
              <Field label="Claim amount (₹)" htmlFor="wc-amount">
                <Input id="wc-amount" type="number" min="0" step="0.01" value={form.claimAmount} onChange={set('claimAmount')} />
              </Field>
            </>
          ) : null}
          <Field label="Reason" htmlFor="wc-reason" className="sm:col-span-2">
            <Input id="wc-reason" value={form.reason} onChange={set('reason')} required maxLength={500} />
          </Field>
          <Field label="Description" htmlFor="wc-desc" className="sm:col-span-2">
            <Textarea id="wc-desc" value={form.description} onChange={set('description')} rows={3} />
          </Field>
          <ModalFooter className="gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Raising…' : 'Raise claim'}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
