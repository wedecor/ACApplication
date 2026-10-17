'use client';

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
import { Building2, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { NativeSelect } from '@/components/common/form-field';
import { Pagination } from '@/components/common/pagination';
import { ACCOUNT_TYPE_LABEL, AccountFormModal } from '@/components/sales/account-form-modal';
import { useAccounts } from '@/hooks/use-sales';
import { ACCOUNT_TYPES, type AccountListQuery, type AccountType } from '@/lib/api/sales';
import { errorMessage } from '@/lib/crm-format';

export default function AccountsPage() {
  const router = useRouter();
  const [query, setQuery] = React.useState<AccountListQuery>({ page: 1, pageSize: 20 });
  const [draft, setDraft] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const { data, isLoading, error } = useAccounts(query);
  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Accounts</h1>
          <p className="text-sm text-muted-foreground">
            B2B customers — housing societies, offices, retail and builders.
          </p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="mr-1 size-4" /> New account
        </Button>
      </header>

      <form
        className="flex max-w-xl gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery((q) => ({ ...q, page: 1, search: draft.trim() || undefined }));
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Search accounts…" className="pl-9" />
        </div>
        <NativeSelect
          className="w-48"
          value={query.type ?? ''}
          onChange={(e) =>
            setQuery((q) => ({ ...q, page: 1, type: (e.target.value || undefined) as AccountType | undefined }))
          }
        >
          <option value="">All types</option>
          {ACCOUNT_TYPES.map((t) => (
            <option key={t} value={t}>
              {ACCOUNT_TYPE_LABEL[t]}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {error ? (
        <p className="text-sm text-destructive">{errorMessage(error, 'Failed to load accounts')}</p>
      ) : isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : items.length === 0 ? (
        <EmptyState icon={Building2} title="No accounts yet" description="Create an account to group B2B customers." />
      ) : (
        <>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Customers</TableHead>
                  <TableHead>Opportunities</TableHead>
                  <TableHead>Tags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Link href={`/accounts/${a.id}`} className="font-medium text-primary hover:underline">
                        {a.name}
                      </Link>
                      {a.gstin ? <p className="text-xs text-muted-foreground">GSTIN {a.gstin}</p> : null}
                    </TableCell>
                    <TableCell>{ACCOUNT_TYPE_LABEL[a.type] ?? a.type}</TableCell>
                    <TableCell className="text-sm">
                      {a.phone ?? '—'}
                      {a.billingEmail ? <p className="text-xs text-muted-foreground">{a.billingEmail}</p> : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{a._count?.customers ?? 0}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{a._count?.opportunities ?? 0}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {a.tags.map((t) => (
                          <Badge key={t} variant="outline">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {data?.pagination ? (
            <Pagination
              {...data.pagination}
              onPageChange={(page) => setQuery((q) => ({ ...q, page }))}
            />
          ) : null}
        </>
      )}

      <AccountFormModal open={open} onOpenChange={setOpen} onSaved={(a) => router.push(`/accounts/${a.id}`)} />
    </div>
  );
}
