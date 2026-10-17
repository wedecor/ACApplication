'use client';

import { Permission } from '@ac/types';
import {
  Button,
  Card,
  CardContent,
  cn,
  EmptyState,
  Input,
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  Skeleton,
} from '@ac/ui';
import { Search, Truck } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';
import { useDebounce } from 'use-debounce';

import { LoadError } from '@/components/common/load-error';
import {
  errorMessage,
  Field,
  Textarea,
  useCan,
} from '@/components/repair/repair-ui';
import { useTransitionWorkshopJob, useWorkshopJobs } from '@/hooks/use-repair';
import { humanize, type WorkshopJob, type WorkshopStatus } from '@/lib/api/repair';
import { formatDate, formatDateTime } from '@/lib/format';

const BOARD_COLUMNS: WorkshopStatus[] = [
  'PICKUP_SCHEDULED',
  'PICKED_UP',
  'RECEIVED_AT_WORKSHOP',
  'DIAGNOSING',
  'AWAITING_APPROVAL',
  'REPAIRING',
  'READY_FOR_DELIVERY',
  'OUT_FOR_DELIVERY',
];

export default function WorkshopPage() {
  const canManage = useCan(Permission.WORKSHOP_MANAGE);
  const [showClosed, setShowClosed] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [debounced] = useDebounce(search, 350);
  const [focusId, setFocusId] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<{ job: WorkshopJob; to: WorkshopStatus } | null>(null);

  React.useEffect(() => {
    setFocusId(new URLSearchParams(window.location.search).get('focus'));
  }, []);

  const statuses: WorkshopStatus[] = showClosed ? ['DELIVERED', 'CANCELLED'] : BOARD_COLUMNS;
  const { data, isLoading, error } = useWorkshopJobs({
    pageSize: 100,
    status: statuses,
    search: debounced || undefined,
  });
  const items = data?.items ?? [];
  const byStatus = React.useMemo(() => {
    const map = new Map<WorkshopStatus, WorkshopJob[]>();
    for (const job of items) map.set(job.status, [...(map.get(job.status) ?? []), job]);
    return map;
  }, [items]);

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workshop</h1>
          <p className="text-sm text-muted-foreground">
            Pickup/drop and carry-in repairs. Customers are notified on pickup, receipt, approval,
            ready and delivery.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-64">
            <Search className="pointer-events-none absolute left-2 top-2.5 size-4 text-muted-foreground" />
            <Input aria-label="Job, booking or customer"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Job, booking or customer"
              className="pl-8"
            />
          </div>
          <Button variant={showClosed ? 'default' : 'outline'} size="sm" onClick={() => setShowClosed((v) => !v)}>
            {showClosed ? 'Show active board' : 'Show delivered / cancelled'}
          </Button>
        </div>
      </header>

      {error ? <LoadError label="workshop jobs" message={(error).message} /> : null}

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No workshop jobs"
          description="Bookings with pickup & drop or carry-in service mode appear here automatically."
        />
      ) : (
        <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          {statuses.map((status) => {
            const jobs = byStatus.get(status) ?? [];
            return (
              <section key={status} className="w-[85vw] max-w-72 shrink-0 snap-start rounded-lg border bg-muted/30 p-2 sm:w-72">
                <h2 className="mb-2 flex items-center justify-between px-1 text-xs font-semibold uppercase text-muted-foreground">
                  {humanize(status)}
                  <span className="tabular-nums">{jobs.length}</span>
                </h2>
                <div className="space-y-2">
                  {jobs.map((job) => (
                    <JobCardItem
                      key={job.id}
                      job={job}
                      focused={job.id === focusId}
                      canManage={canManage}
                      onMove={(to) => setPending({ job, to })}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <TransitionModal pending={pending} onClose={() => setPending(null)} />
    </div>
  );
}

function JobCardItem({
  job,
  focused,
  canManage,
  onMove,
}: {
  job: WorkshopJob;
  focused: boolean;
  canManage: boolean;
  onMove: (to: WorkshopStatus) => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [focused]);
  const forward = job.allowedTransitions.filter((s) => s !== 'CANCELLED');
  return (
    <Card ref={ref} className={cn(focused && 'ring-2 ring-primary')}>
      <CardContent className="space-y-2 p-3 text-sm">
        <div className="min-w-0">
          <Link href={`/bookings/${job.booking.id}`} className="font-medium hover:underline">
            {job.booking.customer.fullName}
          </Link>
          <div className="text-xs text-muted-foreground">{job.number}</div>
        </div>
        <div className="text-xs text-muted-foreground">
          {job.booking.appliance
            ? `${job.booking.appliance.brand} ${job.booking.appliance.modelNumber ?? ''}`
            : humanize(job.booking.category)}
          {' · '}
          {humanize(job.booking.serviceMode)}
        </div>
        {job.pickupScheduledAt && job.status === 'PICKUP_SCHEDULED' ? (
          <div className="text-xs">Pickup {formatDateTime(job.pickupScheduledAt)}</div>
        ) : null}
        {job.estimatedReadyAt ? <div className="text-xs">ETA {formatDate(job.estimatedReadyAt)}</div> : null}
        {canManage && job.allowedTransitions.length ? (
          <div className="flex flex-wrap gap-1 pt-1">
            {forward.map((to) => (
              <Button key={to} size="sm" onClick={() => onMove(to)}>
                → {humanize(to)}
              </Button>
            ))}
            {job.allowedTransitions.includes('CANCELLED') ? (
              <Button size="sm" variant="ghost" onClick={() => onMove('CANCELLED')}>
                Cancel
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function TransitionModal({
  pending,
  onClose,
}: {
  pending: { job: WorkshopJob; to: WorkshopStatus } | null;
  onClose: () => void;
}) {
  const transition = useTransitionWorkshopJob();
  const [note, setNote] = React.useState('');
  const [condition, setCondition] = React.useState('');
  const [accessories, setAccessories] = React.useState('');
  React.useEffect(() => {
    setNote('');
    setCondition(pending?.job.conditionOnReceipt ?? '');
    setAccessories(pending?.job.accessoriesReceived.join(', ') ?? '');
  }, [pending]);

  if (!pending) return null;
  const intake = pending.to === 'PICKED_UP' || pending.to === 'RECEIVED_AT_WORKSHOP';

  const submit = () => {
    transition.mutate(
      {
        id: pending.job.id,
        input: {
          status: pending.to,
          note: note.trim() || undefined,
          ...(intake
            ? {
                conditionOnReceipt: condition.trim() || undefined,
                accessoriesReceived: accessories
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              }
            : {}),
        },
      },
      {
        onSuccess: () => {
          toast.success(`${pending.job.number} → ${humanize(pending.to)}`);
          onClose();
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  return (
    <Modal open onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>
            {pending.job.number}: {humanize(pending.job.status)} → {humanize(pending.to)}
          </ModalTitle>
          <ModalDescription>{pending.job.booking.customer.fullName}</ModalDescription>
        </ModalHeader>
        <div className="space-y-3">
          {intake ? (
            <>
              <Field label="Condition on receipt" htmlFor="ws-cond">
                <Textarea id="ws-cond" value={condition} onChange={(e) => setCondition(e.target.value)} rows={2} />
              </Field>
              <Field label="Accessories received" htmlFor="ws-acc" hint="Comma separated, e.g. Remote, Stand">
                <Input id="ws-acc" value={accessories} onChange={(e) => setAccessories(e.target.value)} />
              </Field>
            </>
          ) : null}
          <Field label="Note" htmlFor="ws-note">
            <Textarea id="ws-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </Field>
        </div>
        <ModalFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Back
          </Button>
          <Button
            variant={pending.to === 'CANCELLED' ? 'destructive' : 'default'}
            onClick={submit}
            disabled={transition.isPending}
          >
            Confirm
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
