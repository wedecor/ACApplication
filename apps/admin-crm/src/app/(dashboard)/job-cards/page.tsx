'use client';

import {
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
import { ClipboardList, Search } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { useDebounce } from 'use-debounce';

import { LoadError } from '@/components/common/load-error';
import { Pagination } from '@/components/common/pagination';
import { JobCardStatusBadge } from '@/components/repair/repair-ui';
import { useJobCards } from '@/hooks/use-repair';
import { humanize, type JobCardStatus } from '@/lib/api/repair';
import { formatDateTime } from '@/lib/format';

const STATUSES: { id: JobCardStatus | undefined; label: string }[] = [
  { id: undefined, label: 'All' },
  { id: 'IN_PROGRESS', label: 'In progress' },
  { id: 'COMPLETED', label: 'Completed' },
  { id: 'DRAFT', label: 'Draft' },
];

export default function JobCardsPage() {
  const [page, setPage] = React.useState(1);
  const [status, setStatus] = React.useState<JobCardStatus | undefined>();
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [debounced] = useDebounce(search, 350);
  React.useEffect(() => setPage(1), [status, from, to, debounced]);

  const { data, isLoading, error } = useJobCards({
    page,
    pageSize: 20,
    status,
    from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
    to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
    search: debounced || undefined,
  });
  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Job cards</h1>
        <p className="text-sm text-muted-foreground">
          Technician diagnosis, readings and checklists for every job.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2 top-2.5 size-4 text-muted-foreground" />
          <Input aria-label="Booking code or customer"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Booking code or customer"
            className="pl-8"
          />
        </div>
        <div className="flex gap-1">
          {STATUSES.map((s) => (
            <Button
              key={s.label}
              size="sm"
              variant={status === s.id ? 'default' : 'outline'}
              onClick={() => setStatus(s.id)}
            >
              {s.label}
            </Button>
          ))}
        </div>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" aria-label="From" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" aria-label="To" />
      </div>

      {error ? <LoadError label="job cards" message={(error).message} /> : null}

      <div className="rounded-md border">
        <Table stackOnMobile>
          <TableHeader>
            <TableRow>
              <TableHead>Booking</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Appliance</TableHead>
              <TableHead>Technician</TableHead>
              <TableHead>Fault codes</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <EmptyState
                    icon={ClipboardList}
                    title="No job cards"
                    description="Job cards appear once technicians start work from the mobile app."
                  />
                </TableCell>
              </TableRow>
            ) : (
              items.map((j) => (
                <TableRow key={j.id}>
                  <TableCell>
                    <Link href={`/job-cards/${j.id}`} className="font-mono text-xs hover:underline">
                      {j.booking?.code ?? j.bookingId}
                    </Link>
                    <div className="text-xs text-muted-foreground">{humanize(j.booking?.category)}</div>
                  </TableCell>
                  <TableCell className="text-sm">{j.booking?.customer.fullName ?? '—'}</TableCell>
                  <TableCell className="text-sm">
                    {j.booking?.appliance ? `${j.booking.appliance.brand} ${j.booking.appliance.modelNumber ?? ''}` : '—'}
                  </TableCell>
                  <TableCell className="text-sm">{j.technician?.fullName ?? '—'}</TableCell>
                  <TableCell className="text-xs">{j.faultCodes.join(', ') || '—'}</TableCell>
                  <TableCell>
                    <JobCardStatusBadge status={j.status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDateTime(j.updatedAt)}</TableCell>
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
    </div>
  );
}
