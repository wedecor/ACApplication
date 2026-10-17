'use client';

import {
  Button,
  EmptyState,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ac/ui';
import { Megaphone, Plus, Users } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { NativeSelect, StatCard } from '@/components/common/form-field';
import { Pagination } from '@/components/common/pagination';
import { CampaignStatusBadge } from '@/components/growth/campaign-status';
import { useCampaigns, useNpsSummary } from '@/hooks/use-growth';
import type { CampaignListQuery, CampaignStatus } from '@/lib/api/growth';
import { errorMessage, formatDateTime } from '@/lib/crm-format';
import { humanizeEnum } from '@/lib/labels';

const STATUSES: CampaignStatus[] = ['DRAFT', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'CANCELLED'];

export default function CampaignsPage() {
  const [query, setQuery] = React.useState<CampaignListQuery>({ page: 1, pageSize: 20 });
  const { data, isLoading, error } = useCampaigns(query);
  const { data: nps } = useNpsSummary();
  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-sm text-muted-foreground">
            Send WhatsApp, SMS, email or push messages to a customer segment. Opted-out customers are skipped.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/campaigns/segments">
              <Users className="mr-1 size-4" /> Segments
            </Link>
          </Button>
          <Button asChild>
            <Link href="/campaigns/new">
              <Plus className="mr-1 size-4" /> New campaign
            </Link>
          </Button>
        </div>
      </header>

      {nps ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="NPS" value={nps.total ? nps.score : '—'} hint={`${nps.total} responses`} />
          <StatCard label="Promoters" value={nps.promoters} />
          <StatCard label="Passives" value={nps.passives} />
          <StatCard label="Detractors" value={nps.detractors} />
          <StatCard label="Avg rating" value={nps.avgRating ? nps.avgRating.toFixed(2) : '—'} />
          <StatCard label="Review requests" value={nps.reviewRequests} />
        </div>
      ) : null}

      <div className="flex max-w-xs">
        <NativeSelect
          aria-label="Campaign status"
          value={query.status ?? ''}
          onChange={(e) =>
            setQuery((q) => ({ ...q, page: 1, status: (e.target.value || undefined) as CampaignStatus | undefined }))
          }
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </NativeSelect>
      </div>

      {error ? (
        <p className="text-sm text-destructive">{errorMessage(error, 'Failed to load campaigns')}</p>
      ) : isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : items.length === 0 ? (
        <EmptyState icon={Megaphone} title="No campaigns yet" description="Create a segment, then a campaign to reach it." />
      ) : (
        <>
          <div className="rounded-lg border">
            <Table stackOnMobile>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Segment</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead className="text-right">Sent / Targeted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link href={`/campaigns/${c.id}`} className="font-medium text-primary hover:underline">
                        {c.name}
                      </Link>
                      {c.coupon ? <p className="font-mono text-xs text-muted-foreground">{c.coupon.code}</p> : null}
                    </TableCell>
                    <TableCell>{c.segment?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-xs">{humanizeEnum(c.channel)}</TableCell>
                    <TableCell>
                      <CampaignStatusBadge status={c.status} />
                    </TableCell>
                    <TableCell className="text-xs">
                      {c.scheduledAt ? formatDateTime(c.scheduledAt) : c.startedAt ? formatDateTime(c.startedAt) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.stats?.sent ?? 0} / {c.stats?.targeted ?? 0}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {data?.pagination ? (
            <Pagination {...data.pagination} onPageChange={(page) => setQuery((q) => ({ ...q, page }))} />
          ) : null}
        </>
      )}
    </div>
  );
}
