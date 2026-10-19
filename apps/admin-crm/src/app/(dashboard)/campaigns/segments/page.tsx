'use client';

import {
  Button,
  EmptyState,
  Input,
  ModalFooter,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ac/ui';
import { ArrowLeft,Plus, RefreshCw, Trash2, Users } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';

import { Field } from '@/components/common/form-field';
import { SimpleModal } from '@/components/common/simple-modal';
import { cleanRules, SegmentBuilder } from '@/components/growth/segment-builder';
import { useDeleteSegment, usePreviewSegment, useSaveSegment, useSegments } from '@/hooks/use-growth';
import type { Segment, SegmentRules } from '@/lib/api/growth';
import { errorMessage, formatDateTime } from '@/lib/crm-format';

function describeRules(r: SegmentRules): string {
  const parts: string[] = [];
  if (r.tags?.length) parts.push(`tags: ${r.tags.join(', ')}`);
  if (r.cityIds?.length) parts.push(`${r.cityIds.length} cities`);
  if (r.categories?.length) parts.push(`booked ${r.categories.length} categories`);
  if (r.minBookings !== undefined) parts.push(`≥${r.minBookings} bookings`);
  if (r.maxBookings !== undefined) parts.push(`≤${r.maxBookings} bookings`);
  if (r.lastBookingBeforeDays !== undefined) parts.push(`inactive ${r.lastBookingBeforeDays}d`);
  if (r.amcStatus) parts.push(`AMC ${r.amcStatus}`);
  if (r.applianceWarrantyExpiringInDays !== undefined)
    parts.push(`warranty ends ≤${r.applianceWarrantyExpiringInDays}d`);
  return parts.length ? parts.join(' · ') : 'All customers';
}

export default function SegmentsPage() {
  const { data, isLoading, error } = useSegments({ page: 1, pageSize: 100 });
  const del = useDeleteSegment();
  const refresh = usePreviewSegment();
  const [editing, setEditing] = React.useState<Segment | 'new' | null>(null);
  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
          href="/campaigns"
          className="-ml-2 inline-flex h-10 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden /> Campaigns
        </Link>
          <h1 className="text-2xl font-bold tracking-tight">Customer segments</h1>
          <p className="text-sm text-muted-foreground">Rule-based audiences for campaigns.</p>
        </div>
        <Button onClick={() => setEditing('new')}>
          <Plus className="mr-1 size-4" /> New segment
        </Button>
      </header>

      {error ? (
        <p className="text-sm text-destructive">{errorMessage(error, 'Failed to load segments')}</p>
      ) : isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : items.length === 0 ? (
        <EmptyState icon={Users} title="No segments" description="Create a segment to target a campaign." />
      ) : (
        <div className="rounded-lg border">
          <Table stackOnMobile>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Rules</TableHead>
                <TableHead className="text-right">Members</TableHead>
                <TableHead>Computed</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <button type="button" className="font-medium text-primary hover:underline" onClick={() => setEditing(s)}>
                      {s.name}
                    </button>
                    {s.description ? <p className="text-xs text-muted-foreground">{s.description}</p> : null}
                  </TableCell>
                  <TableCell className="max-w-md text-xs text-muted-foreground">{describeRules(s.rules)}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.memberCount.toLocaleString('en-IN')}</TableCell>
                  <TableCell className="text-xs">{s.lastComputedAt ? formatDateTime(s.lastComputedAt) : '—'}</TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Recount members"
                      disabled={refresh.isPending}
                      onClick={() =>
                        refresh.mutate(s.id, { onError: (err) => toast.error(errorMessage(err)) })
                      }
                    >
                      <RefreshCw className="size-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Delete"
                      disabled={del.isPending}
                      onClick={() => {
                        if (window.confirm(`Delete segment "${s.name}"?`)) {
                          del.mutate(s.id, {
                            onSuccess: () => toast.success('Segment deleted'),
                            onError: (err) => toast.error(errorMessage(err)),
                          });
                        }
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <SegmentModal
        key={editing === 'new' ? 'new' : editing?.id ?? 'closed'}
        segment={editing}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

function SegmentModal({ segment, onClose }: { segment: Segment | 'new' | null; onClose: () => void }) {
  const existing = segment && segment !== 'new' ? segment : null;
  const save = useSaveSegment();
  const [name, setName] = React.useState(existing?.name ?? '');
  const [description, setDescription] = React.useState(existing?.description ?? '');
  const [rules, setRules] = React.useState<SegmentRules>(existing?.rules ?? {});

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await save.mutateAsync({
        id: existing?.id,
        input: { name: name.trim(), description: description.trim() || undefined, rules: cleanRules(rules) },
      });
      toast.success('Segment saved');
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <SimpleModal
      open={segment !== null}
      onOpenChange={(o) => !o && onClose()}
      title={existing ? 'Edit segment' : 'New segment'}
      description="Customers must match every rule you set. Empty rules match all customers."
      className="max-w-4xl"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
          </Field>
          <Field label="Description">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>
        <SegmentBuilder rules={rules} onChange={setRules} />
        <ModalFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            Save segment
          </Button>
        </ModalFooter>
      </form>
    </SimpleModal>
  );
}
