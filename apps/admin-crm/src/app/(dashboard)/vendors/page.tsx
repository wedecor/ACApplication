'use client';

import * as React from 'react';
import Link from 'next/link';
import { Building2, Plus, Search, Star } from 'lucide-react';
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

import { LoadError } from '@/components/common/load-error';
import { Pagination } from '@/components/common/pagination';
import { useVendors } from '@/hooks/use-inventory';
import { formatMinor, formatPercent } from '@/lib/format';

const STATUSES: Array<{ id: string | 'ALL'; label: string }> = [
  { id: 'ALL', label: 'All' },
  { id: 'ACTIVE', label: 'Active' },
  { id: 'PROSPECT', label: 'Prospect' },
  { id: 'ON_HOLD', label: 'On hold' },
  { id: 'BLACKLISTED', label: 'Blacklisted' },
];

export default function VendorsPage() {
  const [filters, setFilters] = React.useState<Record<string, unknown>>({ page: 1, pageSize: 20 });
  const [search, setSearch] = React.useState('');
  const [debouncedSearch] = useDebounce(search, 350);
  React.useEffect(() => {
    setFilters((f) => ({ ...f, search: debouncedSearch || undefined, page: 1 }));
  }, [debouncedSearch]);

  const { data, isLoading, error } = useVendors(filters);
  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Vendors</h1>
          <p className="text-sm text-muted-foreground">
            Suppliers powering procurement. Track payment terms, performance and lifetime spend.
          </p>
        </div>
        <Button asChild>
          <Link href="/vendors/new">
            <Plus className="size-4" />
            New vendor
          </Link>
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-2 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, GST, phone or email"
            className="pl-8"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {STATUSES.map((s) => (
            <Button
              key={s.id}
              size="sm"
              variant={(filters.status ?? 'ALL') === s.id ? 'default' : 'outline'}
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  status: s.id === 'ALL' ? undefined : s.id,
                  page: 1,
                }))
              }
            >
              {s.label}
            </Button>
          ))}
        </div>
      </div>

      {error ? <LoadError label="vendors" message={(error as Error).message} /> : null}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>GSTIN</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead className="text-right">Rating</TableHead>
              <TableHead className="text-right">On-time</TableHead>
              <TableHead className="text-right">Lifetime spend</TableHead>
              <TableHead>Status</TableHead>
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
                  <EmptyState
                    icon={Building2}
                    title="No vendors yet"
                    description="Add vendors before raising purchase orders."
                  />
                </TableCell>
              </TableRow>
            ) : (
              items.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>
                    <code className="font-mono text-xs">{v.code}</code>
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link href={`/vendors/${v.id}`} className="hover:underline">
                      {v.companyName}
                    </Link>
                  </TableCell>
                  <TableCell>{v.gstin ?? '—'}</TableCell>
                  <TableCell className="text-xs">
                    <div>{v.contactPerson ?? '—'}</div>
                    <div className="text-muted-foreground">{v.phone ?? v.email ?? '—'}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center gap-1">
                      <Star className="size-3.5 fill-yellow-400 text-yellow-500" />
                      {v.rating.toFixed(1)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{formatPercent(v.onTimeRate)}</TableCell>
                  <TableCell className="text-right">{formatMinor(v.lifetimeSpendMinor)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        v.status === 'ACTIVE'
                          ? 'default'
                          : v.status === 'BLACKLISTED'
                            ? 'destructive'
                            : 'outline'
                      }
                    >
                      {v.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {data && data.meta.totalPages > 1 ? (
        <Pagination
          page={data.meta.page}
          pageSize={data.meta.pageSize}
          total={data.meta.total}
          totalPages={data.meta.totalPages}
          onPageChange={(p) => setFilters((prev) => ({ ...prev, page: p }))}
        />
      ) : null}
    </div>
  );
}
