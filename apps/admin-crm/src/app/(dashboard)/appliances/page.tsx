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
import { NativeSelect } from '@/components/repair/repair-ui';
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
        <h1 className="text-xl font-semibold tracking-tight">Appliances</h1>
        <p className="text-sm text-muted-foreground">
          Every unit we service, with its warranty windows and full repair history. Register new
          appliances from the customer page.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-2 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Brand, model, customer name or phone"
            className="pl-8"
          />
        </div>
        <Input
          value={serial}
          onChange={(e) => setSerial(e.target.value)}
          placeholder="Exact serial number"
          className="w-48"
        />
        <NativeSelect
          value={category}
          onChange={(e) => setCategory(e.target.value as ServiceCategory | '')}
          className="w-52"
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Appliance</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Serial</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Mfr. warranty</TableHead>
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
                  <TableCell>{formatDate(a.manufacturerWarrantyUntil)}</TableCell>
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
