'use client';

import {
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ac/ui';
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import Link from 'next/link';
import * as React from 'react';

import type { BookingListItem } from '@/lib/api/bookings';
import { formatWhen } from '@/lib/format';
import { categoryLabel } from '@/lib/labels';

import { BookingPaymentBadge, BookingStatusBadge } from './booking-status-badge';

function formatINR(minor: number | null | undefined): string {
  if (minor == null) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(minor / 100);
}

export function BookingsTable({ data, isLoading }: { data: BookingListItem[]; isLoading: boolean }) {
  const columns = React.useMemo<ColumnDef<BookingListItem>[]>(
    () => [
      {
        accessorKey: 'code',
        header: 'Code',
        meta: { hideOnMobile: true },
        cell: ({ row }) => (
          <Link
            href={`/bookings/${row.original.id}`}
            className="whitespace-nowrap font-mono text-xs font-semibold text-primary hover:underline"
          >
            {row.original.code}
          </Link>
        ),
      },
      {
        accessorKey: 'customer',
        header: 'Customer',
        meta: { primary: true },
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col">
            <Link
              href={`/bookings/${row.original.id}`}
              className="truncate font-medium hover:underline max-md:after:absolute max-md:after:inset-0"
            >
              {row.original.customer.fullName}
            </Link>
            <span className="text-xs text-muted-foreground">
              {row.original.customer.phone}
              <span className="md:hidden"> · {row.original.code}</span>
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'category',
        header: 'Service',
        cell: ({ row }) => (
          <div className="text-sm">
            {categoryLabel(row.original.category)}
            {row.original.serviceType ? (
              <span className="block text-xs text-muted-foreground">{row.original.serviceType}</span>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: 'scheduledAt',
        header: 'Scheduled',
        cell: ({ row }) => (
          <div className="text-sm">
            {formatWhen(row.original.scheduledAt)}
            {row.original.scheduledTimeSlot ? (
              <span className="block text-xs text-muted-foreground">{row.original.scheduledTimeSlot}</span>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: 'technician',
        header: 'Technician',
        cell: ({ row }) => row.original.technician?.fullName ?? (
          <span className="text-xs text-muted-foreground">Unassigned</span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <BookingStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'paymentStatus',
        header: 'Payment',
        cell: ({ row }) => (
          <div className="flex flex-col gap-1">
            <BookingPaymentBadge status={row.original.paymentStatus} />
            <span className="text-xs text-muted-foreground">
              {formatINR(
                row.original.finalAmount?.amountMinor ??
                  row.original.estimatedAmount?.amountMinor ??
                  0,
              )}
            </span>
          </div>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table stackOnMobile>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead key={h.id}>
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((_c, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      data-primary={cell.column.columnDef.meta?.primary ? '' : undefined}
                      className={cell.column.columnDef.meta?.hideOnMobile ? 'max-md:hidden' : undefined}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
        </TableBody>
      </Table>
    </div>
  );
}
