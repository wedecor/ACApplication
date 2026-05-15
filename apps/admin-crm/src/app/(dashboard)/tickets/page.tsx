'use client';

import * as React from 'react';
import Link from 'next/link';
import { useDebounce } from 'use-debounce';

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

import { Pagination } from '@/components/common/pagination';
import { useTickets } from '@/hooks/use-support';
import type {
  TicketPriority,
  TicketStatus,
  TicketSummary,
} from '@/lib/api/support';
import { formatDate, formatDateTime } from '@/lib/format';

const STATUSES: Array<{ id: 'ALL' | TicketStatus; label: string }> = [
  { id: 'ALL', label: 'All' },
  { id: 'OPEN', label: 'Open' },
  { id: 'PENDING', label: 'Pending' },
  { id: 'WAITING_CUSTOMER', label: 'Waiting' },
  { id: 'ESCALATED', label: 'Escalated' },
  { id: 'RESOLVED', label: 'Resolved' },
  { id: 'CLOSED', label: 'Closed' },
];

const PRIORITY_VARIANT: Record<
  TicketPriority,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  LOW: 'outline',
  NORMAL: 'secondary',
  HIGH: 'default',
  URGENT: 'destructive',
};

const STATUS_VARIANT: Record<
  TicketStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  OPEN: 'default',
  PENDING: 'secondary',
  WAITING_CUSTOMER: 'secondary',
  ON_HOLD: 'outline',
  ESCALATED: 'destructive',
  RESOLVED: 'outline',
  CLOSED: 'outline',
};

export default function TicketsPage() {
  const [filters, setFilters] = React.useState<{
    status: 'ALL' | TicketStatus;
    search: string;
    page: number;
    overdue: boolean;
  }>({ status: 'ALL', search: '', page: 1, overdue: false });
  const [debounced] = useDebounce(filters.search, 250);
  const { data, isLoading } = useTickets({
    page: filters.page,
    pageSize: 20,
    search: debounced || undefined,
    status: filters.status === 'ALL' ? undefined : [filters.status as TicketStatus],
    overdue: filters.overdue ? 'true' : undefined,
  });
  const items = (data?.items ?? []) as TicketSummary[];

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Tickets</h1>
          <p className="text-sm text-muted-foreground">
            Every support case across all channels, with SLA timers and CSAT.
          </p>
        </div>
        <Input
          placeholder="Search ticket #, subject…"
          className="sm:w-72"
          value={filters.search}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, search: e.target.value, page: 1 }))
          }
        />
      </header>

      <div className="flex flex-wrap items-center gap-1">
        {STATUSES.map((s) => (
          <Button
            key={s.id}
            size="sm"
            variant={filters.status === s.id ? 'default' : 'outline'}
            onClick={() => setFilters((prev) => ({ ...prev, status: s.id, page: 1 }))}
          >
            {s.label}
          </Button>
        ))}
        <Button
          size="sm"
          variant={filters.overdue ? 'destructive' : 'outline'}
          onClick={() =>
            setFilters((prev) => ({ ...prev, overdue: !prev.overdue, page: 1 }))
          }
        >
          Overdue
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : items.length === 0 ? (
        <EmptyState title="No tickets" description="Adjust filters or create a new ticket." />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>SLA due</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">
                    <Link href={`/tickets/${t.id}`} className="hover:underline">
                      {t.number}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[24ch] truncate">{t.subject}</TableCell>
                  <TableCell>{t.customer?.fullName ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{t.source.replace('_', ' ')}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={PRIORITY_VARIANT[t.priority]}>{t.priority}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[t.status]}>{t.status.replace('_', ' ')}</Badge>
                  </TableCell>
                  <TableCell>
                    {t.assignedAgent
                      ? `${t.assignedAgent.firstName ?? ''} ${t.assignedAgent.lastName ?? ''}`.trim()
                      : '—'}
                  </TableCell>
                  <TableCell className="text-xs">
                    {t.resolutionDueAt ? formatDate(t.resolutionDueAt) : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTime(t.updatedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {data ? (
        <Pagination
          page={data.meta.page}
          pageSize={data.meta.pageSize}
          total={data.meta.total}
          totalPages={data.meta.totalPages}
          onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
        />
      ) : null}
    </div>
  );
}
