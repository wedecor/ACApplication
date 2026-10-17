'use client';

import { LeadStatus } from '@ac/types';
import {
  Avatar,
  AvatarFallback,
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

import type { LeadListItem } from '@/lib/api/leads';
import { categoryLabel, leadSourceLabel } from '@/lib/labels';

import { LeadPriorityBadge } from './lead-priority-badge';
import { LeadStatusBadge } from './lead-status-badge';

interface Props {
  data: LeadListItem[];
  isLoading: boolean;
}

export function LeadsTable({ data, isLoading }: Props) {
  const columns = React.useMemo<ColumnDef<LeadListItem>[]>(
    () => [
      {
        accessorKey: 'code',
        header: 'Code',
        meta: { hideOnMobile: true },
        cell: ({ row }) => (
          <Link
            href={`/leads/${row.original.id}`}
            className="whitespace-nowrap font-mono text-xs font-semibold text-primary hover:underline"
          >
            {row.original.code}
          </Link>
        ),
      },
      {
        accessorKey: 'customerName',
        header: 'Customer',
        meta: { primary: true },
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col">
            <Link
              href={`/leads/${row.original.id}`}
              className="truncate font-medium hover:underline max-md:after:absolute max-md:after:inset-0"
            >
              {row.original.customerName}
            </Link>
            <span className="text-xs text-muted-foreground">
              {row.original.phone}
              <span className="md:hidden"> · {row.original.code}</span>
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'source',
        header: 'Source',
        cell: ({ row }) => (
          <Badge variant="outline">{leadSourceLabel(row.original.source)}</Badge>
        ),
      },
      {
        accessorKey: 'applianceType',
        header: 'Appliance',
        cell: ({ row }) => (
          <span className="text-sm">{categoryLabel(row.original.applianceType)}</span>
        ),
      },
      {
        accessorKey: 'priority',
        header: 'Priority',
        cell: ({ row }) => <LeadPriorityBadge priority={row.original.priority} />,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <LeadStatusBadge status={row.original.status as LeadStatus} />,
      },
      {
        accessorKey: 'assignedUser',
        header: 'Owner',
        cell: ({ row }) => {
          const u = row.original.assignedUser;
          if (!u) return <span className="text-xs text-muted-foreground">Unassigned</span>;
          const initials = `${u.firstName?.[0] ?? ''}${u.lastName?.[0] ?? ''}`.toUpperCase() || '?';
          return (
            <div className="flex items-center gap-2">
              <Avatar className="size-6">
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <span className="text-sm">
                {[u.firstName, u.lastName].filter(Boolean).join(' ') || u.email}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: 'createdAt',
        header: 'Created',
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(row.original.createdAt as unknown as string), { addSuffix: true })}
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

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table stackOnMobile>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead key={h.id}>
                  {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
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
