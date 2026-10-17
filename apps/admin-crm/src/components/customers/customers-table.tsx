'use client';

import {
  Badge,
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
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import * as React from 'react';

import type { CustomerDetail, CustomerListItem } from '@/lib/api/customers';

function formatINR(minor: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(minor / 100);
}

interface Props {
  data: CustomerListItem[];
  isLoading: boolean;
}

export function CustomersTable({ data, isLoading }: Props) {
  const columns = React.useMemo<ColumnDef<CustomerListItem>[]>(
    () => [
      {
        accessorKey: 'fullName',
        header: 'Customer',
        meta: { primary: true },
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col">
            <Link
              href={`/customers/${row.original.id}`}
              className="truncate font-medium text-primary hover:underline max-md:text-foreground max-md:after:absolute max-md:after:inset-0"
            >
              {row.original.fullName}
            </Link>
            <span className="text-xs text-muted-foreground">{row.original.phone}</span>
          </div>
        ),
      },
      {
        id: 'city',
        header: 'City',
        cell: ({ row }) =>
          row.original.city ? (
            <span className="text-sm">
              {row.original.city.name}, {row.original.city.state}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: 'tags',
        header: 'Tags',
        cell: ({ row }) => {
          const tags = (row.original as CustomerDetail).tags ?? [];
          return tags.length ? (
            <div className="flex flex-wrap gap-1">
              {tags.slice(0, 3).map((t) => (
                <Badge key={t} variant="outline">
                  {t}
                </Badge>
              ))}
              {tags.length > 3 ? <Badge variant="muted">+{tags.length - 3}</Badge> : null}
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      },
      {
        accessorKey: 'totalBookings',
        header: 'Bookings',
        cell: ({ row }) => (
          <Badge variant="secondary">{row.original.totalBookings}</Badge>
        ),
      },
      {
        id: 'lifetime',
        header: 'Lifetime value',
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">
            {formatINR(row.original.lifetimeValueMinor)}
          </span>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: 'Joined',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDistanceToNow(new Date(row.original.createdAt), { addSuffix: true })}
          </span>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table stackOnMobile>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} data-primary={cell.column.columnDef.meta?.primary ? '' : undefined}>
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
