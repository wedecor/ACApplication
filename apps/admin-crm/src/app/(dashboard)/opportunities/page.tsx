'use client';

import { Badge, Button, Card, CardContent, Input, ModalFooter, Skeleton } from '@ac/ui';
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2, UserPlus } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';

import { Field, NativeSelect, StatCard } from '@/components/common/form-field';
import { SimpleModal } from '@/components/common/simple-modal';
import { OpportunityFormModal } from '@/components/sales/opportunity-form-modal';
import {
  useDeleteOpportunity,
  useMoveOpportunityStage,
  useOpportunities,
  useOpportunityFromLead,
  usePipeline,
} from '@/hooks/use-sales';
import { type Opportunity, type OpportunityStage, OPPORTUNITY_STAGES } from '@/lib/api/sales';
import { errorMessage, formatDate, formatINR, rupeesToMinor } from '@/lib/crm-format';
import { humanizeEnum } from '@/lib/labels';

const OPEN_FLOW: OpportunityStage[] = ['NEW', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON'];

const STAGE_TONE: Record<OpportunityStage, string> = {
  NEW: 'border-t-slate-400',
  QUALIFIED: 'border-t-sky-500',
  PROPOSAL: 'border-t-violet-500',
  NEGOTIATION: 'border-t-amber-500',
  WON: 'border-t-emerald-500',
  LOST: 'border-t-rose-500',
};

export default function OpportunitiesPage() {
  const [search, setSearch] = React.useState('');
  const [searchDraft, setSearchDraft] = React.useState('');
  const { data, isLoading, error } = useOpportunities({ pageSize: 100, search: search || undefined });
  const { data: pipeline } = usePipeline();
  const move = useMoveOpportunityStage();
  const del = useDeleteOpportunity();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Opportunity | null>(null);
  const [losing, setLosing] = React.useState<Opportunity | null>(null);
  const [leadOpen, setLeadOpen] = React.useState(false);
  const [initialLeadId, setInitialLeadId] = React.useState('');

  // Deep link: /opportunities?leadId=… opens the convert-from-lead dialog.
  React.useEffect(() => {
    const leadId = new URLSearchParams(window.location.search).get('leadId');
    if (leadId) {
      setInitialLeadId(leadId);
      setLeadOpen(true);
    }
  }, []);

  const byStage = React.useMemo(() => {
    const map = new Map<OpportunityStage, Opportunity[]>();
    for (const s of OPPORTUNITY_STAGES) map.set(s, []);
    for (const o of data?.items ?? []) map.get(o.stage)?.push(o);
    return map;
  }, [data]);

  const moveTo = async (o: Opportunity, stage: OpportunityStage) => {
    if (stage === 'LOST') {
      setLosing(o);
      return;
    }
    try {
      await move.mutateAsync({ id: o.id, stage });
      toast.success(`Moved to ${stage}`);
    } catch (err) {
      toast.error(errorMessage(err, 'Stage change failed'));
    }
  };

  const onDelete = async (o: Opportunity) => {
    if (!window.confirm(`Delete "${o.title}"?`)) return;
    try {
      await del.mutateAsync(o.id);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Opportunities</h1>
          <p className="text-sm text-muted-foreground">Sales pipeline for AMC contracts and B2B deals.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setLeadOpen(true)}>
            <UserPlus className="mr-1 size-4" /> From lead
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 size-4" /> New opportunity
          </Button>
        </div>
      </header>

      {pipeline ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Open deals" value={pipeline.openCount} />
          <StatCard label="Open value" value={formatINR(pipeline.openValueMinor)} />
          <StatCard label="Weighted forecast" value={formatINR(pipeline.weightedForecastMinor)} />
          <StatCard label="Won" value={formatINR(pipeline.wonValueMinor)} hint={`${pipeline.wonCount} deals`} />
          <StatCard label="Win rate" value={`${Math.round(pipeline.winRatePct)}%`} hint={`${pipeline.lostCount} lost`} />
        </div>
      ) : null}

      <form
        className="flex max-w-md gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(searchDraft.trim());
        }}
      >
        <Input
          type="search"
          aria-label="Search opportunities"
          className="min-w-0 flex-1"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          placeholder="Search opportunities"
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {error ? (
        <p className="text-sm text-destructive">{errorMessage(error, 'Failed to load opportunities')}</p>
      ) : isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          {OPPORTUNITY_STAGES.map((stage) => {
            const items = byStage.get(stage) ?? [];
            const summary = pipeline?.stages.find((s) => s.stage === stage);
            return (
              <div key={stage} className={`w-[85vw] max-w-72 shrink-0 snap-start rounded-lg border border-t-4 bg-muted/30 sm:w-72 ${STAGE_TONE[stage]}`}>
                <div className="flex items-baseline justify-between px-3 py-2">
                  <span className="text-sm font-semibold">{humanizeEnum(stage)}</span>
                  <span className="text-xs text-muted-foreground">
                    {summary?.count ?? items.length} · {formatINR(summary?.valueMinor ?? items.reduce((a, o) => a + o.valueMinor, 0))}
                  </span>
                </div>
                <div className="space-y-2 px-2 pb-2">
                  {items.length === 0 ? (
                    <p className="px-1 py-4 text-center text-xs text-muted-foreground">Empty</p>
                  ) : (
                    items.map((o) => (
                      <OpportunityCard
                        key={o.id}
                        o={o}
                        onMove={(s) => void moveTo(o, s)}
                        onEdit={() => setEditing(o)}
                        onDelete={() => void onDelete(o)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <OpportunityFormModal open={createOpen} onOpenChange={setCreateOpen} />
      <OpportunityFormModal open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)} opportunity={editing} />
      <LostReasonModal opportunity={losing} onClose={() => setLosing(null)} />
      <FromLeadModal open={leadOpen} onOpenChange={setLeadOpen} initialLeadId={initialLeadId} />
    </div>
  );
}

function OpportunityCard({
  o,
  onMove,
  onEdit,
  onDelete,
}: {
  o: Opportunity;
  onMove: (s: OpportunityStage) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const idx = OPEN_FLOW.indexOf(o.stage);
  const prev = idx > 0 ? OPEN_FLOW[idx - 1] : undefined;
  const next = idx >= 0 && idx < OPEN_FLOW.length - 1 ? OPEN_FLOW[idx + 1] : undefined;
  const closed = o.stage === 'WON' || o.stage === 'LOST';
  return (
    <Card className="shadow-sm">
      <CardContent className="space-y-2 p-3 text-sm">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium leading-tight">{o.title}</p>
          <div className="flex shrink-0">
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Edit ${o.title}`}
              className="grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Pencil className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label={`Delete ${o.title}`}
              className="grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {o.account ? (
            <Link href={`/accounts/${o.account.id}`} className="hover:underline">
              {o.account.name}
            </Link>
          ) : o.customer ? (
            <Link href={`/customers/${o.customer.id}`} className="hover:underline">
              {o.customer.fullName}
            </Link>
          ) : o.lead ? (
            <Link href={`/leads/${o.lead.id}`} className="hover:underline">
              {o.lead.code} · {o.lead.customerName}
            </Link>
          ) : (
            '—'
          )}
        </p>
        <div className="flex items-center justify-between">
          <span className="font-semibold tabular-nums">{formatINR(o.valueMinor)}</span>
          <Badge variant="muted">{o.probabilityPct}%</Badge>
        </div>
        {o.expectedCloseAt && !closed ? (
          <p className="text-xs text-muted-foreground">Close by {formatDate(o.expectedCloseAt)}</p>
        ) : null}
        {o.stage === 'LOST' && o.lostReason ? (
          <p className="text-xs text-destructive">Lost: {o.lostReason}</p>
        ) : null}
        <div className="flex items-center gap-1 border-t pt-2">
          {closed ? (
            <Button size="sm" variant="ghost" className="h-9 px-3" onClick={() => onMove('NEGOTIATION')}>
              Reopen
            </Button>
          ) : (
            <>
              <Button size="sm" variant="ghost" className="size-9 p-0" disabled={!prev} onClick={() => prev && onMove(prev)} aria-label="Previous stage">
                <ChevronLeft className="size-4" />
              </Button>
              <Button size="sm" variant="ghost" className="size-9 p-0" disabled={!next} onClick={() => next && onMove(next)} aria-label="Next stage">
                <ChevronRight className="size-4" />
              </Button>
              <NativeSelect
                className="h-9 min-w-0 flex-1 px-2 text-sm"
                value=""
                onChange={(e) => e.target.value && onMove(e.target.value as OpportunityStage)}
                aria-label="Move to stage"
              >
                <option value="">Move to…</option>
                {OPPORTUNITY_STAGES.filter((s) => s !== o.stage).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </NativeSelect>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function LostReasonModal({ opportunity, onClose }: { opportunity: Opportunity | null; onClose: () => void }) {
  const move = useMoveOpportunityStage();
  const [reason, setReason] = React.useState('');
  const [details, setDetails] = React.useState('');
  React.useEffect(() => {
    setReason('');
    setDetails('');
  }, [opportunity]);
  const lostReason = details.trim() ? (reason ? `${reason}: ${details.trim()}` : details.trim()) : reason;
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opportunity || !lostReason) return;
    try {
      await move.mutateAsync({ id: opportunity.id, stage: 'LOST', lostReason });
      toast.success('Marked as lost');
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  return (
    <SimpleModal
      open={Boolean(opportunity)}
      onOpenChange={(o) => !o && onClose()}
      title="Mark opportunity lost"
      description={opportunity?.title}
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Lost reason *">
          <NativeSelect value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">Select…</option>
            {['Price too high', 'Chose competitor', 'No response', 'Not a fit', 'Budget deferred', 'Other'].map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Details">
          <Input value={details} onChange={(e) => setDetails(e.target.value)} />
        </Field>
        <ModalFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="destructive" disabled={!lostReason || move.isPending}>
            Mark lost
          </Button>
        </ModalFooter>
      </form>
    </SimpleModal>
  );
}

function FromLeadModal({
  open,
  onOpenChange,
  initialLeadId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialLeadId: string;
}) {
  const convert = useOpportunityFromLead();
  const [leadId, setLeadId] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [value, setValue] = React.useState('');
  React.useEffect(() => {
    if (open) {
      setLeadId(initialLeadId);
      setTitle('');
      setValue('');
    }
  }, [open, initialLeadId]);
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await convert.mutateAsync({
        leadId: leadId.trim(),
        title: title.trim() || undefined,
        valueMinor: value ? rupeesToMinor(value) : undefined,
      });
      toast.success('Opportunity created from lead');
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err, 'Conversion failed'));
    }
  };
  return (
    <SimpleModal
      open={open}
      onOpenChange={onOpenChange}
      title="Convert lead to opportunity"
      description="Use the lead id from the lead detail page URL."
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Lead id *">
          <Input required value={leadId} onChange={(e) => setLeadId(e.target.value)} />
        </Field>
        <Field label="Title (defaults to lead name)">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Value (₹)">
          <Input type="number" min="0" value={value} onChange={(e) => setValue(e.target.value)} />
        </Field>
        <ModalFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={!leadId.trim() || convert.isPending}>
            Convert
          </Button>
        </ModalFooter>
      </form>
    </SimpleModal>
  );
}
