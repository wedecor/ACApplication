'use client';

import type { ServiceCategory } from '@ac/types';
import {
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
import { Refrigerator, Search } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { useDebounce } from 'use-debounce';

import { LoadError } from '@/components/common/load-error';
import { Pagination } from '@/components/common/pagination';
import { NativeSelect, WarrantyBadge } from '@/components/repair/repair-ui';
import { useAppliances } from '@/hooks/use-repair';
import { humanize, SERVICE_CATEGORIES } from '@/lib/api/repair';
import { formatDate } from '@/lib/format';

export default function AppliancesPage() {
  const [page, setPage] = React.useState(1);
  const [q, setQ] = React.useState('');
  const [serial, setSerial] = React.useState('');
  const [category, setCategory] = React.useState<ServiceCategory | ''>('');
  const [debouncedQ] = useDebounce(q, 350);
  const [debouncedSerial] = useDebounce(serial, 350);

  React.useEffect(() => setPage(1), [debouncedQ, debouncedSerial, category]);

  const { data, isLoading, error } = useAppliances({
    page,
    pageSize: 20,
    q: debouncedQ || undefined,
    serial: debouncedSerial || undefined,
    category: category || undefined,
  });
  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Appliances</h1>
        <p className="text-sm text-muted-foreground">
          Every unit we service, with its warranty windows and full repair history. Register new
          appliances from the customer page.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <div className="relative col-span-2 sm:w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            aria-label="Search appliances"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Brand, model, customer or phone"
            className="pl-9"
          />
        </div>
        <Input
          value={serial}
          onChange={(e) => setSerial(e.target.value)}
          placeholder="Serial number"
          aria-label="Exact serial number"
          className="min-w-0 sm:w-48"
        />
        <NativeSelect
          value={category}
          onChange={(e) => setCategory(e.target.value as ServiceCategory | '')}
          className="min-w-0 sm:w-52"
          aria-label="Category"
        >
          <option value="">All categories</option>
          {SERVICE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {humanize(c)}
            </option>
          ))}
        </NativeSelect>
      </div>

      {error ? <LoadError label="appliances" message={(error).message} /> : null}

      <div className="rounded-md border">
        <Table stackOnMobile>
          <TableHeader>
            <TableRow>
              <TableHead>Appliance</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Serial</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Warranty</TableHead>
              <TableHead>Last serviced</TableHead>
              <TableHead className="text-right">Bookings</TableHead>
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
                    icon={Refrigerator}
                    title="No appliances found"
                    description="Register appliances from a customer's page to track their service history."
                  />
                </TableCell>
              </TableRow>
            ) : (
              items.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">
                    <Link href={`/appliances/${a.id}`} className="hover:underline">
                      {a.brand} {a.modelNumber ?? ''}
                    </Link>
                    {a.capacity ? (
                      <div className="text-xs text-muted-foreground">{a.capacity}</div>
                    ) : null}
                  </TableCell>
                  <TableCell>{humanize(a.category)}</TableCell>
                  <TableCell className="font-mono text-xs">{a.serialNumber ?? '—'}</TableCell>
                  <TableCell className="text-xs">
                    {a.customer ? (
                      <Link href={`/customers/${a.customer.id}`} className="hover:underline">
                        {a.customer.fullName}
                      </Link>
                    ) : (
                      '—'
                    )}
                    <div className="text-muted-foreground">{a.customer?.phone}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-end gap-0.5 md:items-start">
                      <WarrantyBadge manufacturerUntil={a.manufacturerWarrantyUntil} extendedUntil={a.extendedWarrantyUntil} />
                      {a.manufacturerWarrantyUntil ? (
                        <span className="text-xs text-muted-foreground">{formatDate(a.manufacturerWarrantyUntil)}</span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(a.lastServicedAt)}</TableCell>
                  <TableCell className="text-right tabular-nums">{a._count?.bookings ?? 0}</TableCell>
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
