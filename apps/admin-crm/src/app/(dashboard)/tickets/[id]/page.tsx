'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  AlertOctagon,
  ArrowLeft,
  Clock,
  Headphones,
  MessageSquare,
  PenSquare,
  Send,
  Star,
  Tag,
  UserCircle,
} from 'lucide-react';

import {
  Badge,
  Button,
  EmptyState,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@ac/ui';

import {
  useTicket,
  useTicketActions,
  useTicketActivities,
  useTicketCustomerContext,
  useTicketMessages,
} from '@/hooks/use-support';
import type {
  ConversationChannel,
  TicketPriority,
  TicketStatus,
} from '@/lib/api/support';
import { formatDate, formatDateTime } from '@/lib/format';

const PRIORITY_VARIANT: Record<TicketPriority, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  LOW: 'outline',
  NORMAL: 'secondary',
  HIGH: 'default',
  URGENT: 'destructive',
};

const STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: 'Open',
  PENDING: 'Pending',
  WAITING_CUSTOMER: 'Waiting on customer',
  ON_HOLD: 'On hold',
  ESCALATED: 'Escalated',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const ticket = useTicket(id);
  const activities = useTicketActivities(id);
  const messages = useTicketMessages(id);
  const context = useTicketCustomerContext(id);
  const actions = useTicketActions(id);

  const t = ticket.data;

  const [draft, setDraft] = React.useState('');
  const [channel, setChannel] = React.useState<ConversationChannel>('WHATSAPP');
  const [internal, setInternal] = React.useState(false);

  const submit = () => {
    if (!draft.trim()) return;
    if (internal) {
      actions.addNote.mutate(
        { body: draft, isInternal: true },
        { onSuccess: () => setDraft('') },
      );
    } else {
      actions.reply.mutate(
        { body: draft, channel },
        { onSuccess: () => setDraft('') },
      );
    }
  };

  return (
    <div className="space-y-4">
      <Link
        href="/tickets"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
      >
        <ArrowLeft className="size-3" />
        Back to tickets
      </Link>

      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-md border bg-muted p-3">
            <Headphones className="size-5" />
          </div>
          <div>
            {ticket.isLoading ? (
              <Skeleton className="h-7 w-72" />
            ) : (
              <>
                <h1 className="text-xl font-semibold tracking-tight">
                  {t?.subject ?? '—'}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {t?.number} · created {t ? formatDateTime(t.createdAt) : ''}
                </p>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {t ? (
            <>
              <Badge variant={PRIORITY_VARIANT[t.priority]}>{t.priority}</Badge>
              <Badge>{STATUS_LABEL[t.status]}</Badge>
              {t.escalationLevel > 0 ? (
                <Badge variant="destructive" className="gap-1">
                  <AlertOctagon className="size-3" />
                  L{t.escalationLevel}
                </Badge>
              ) : null}
            </>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            onClick={() => actions.resolve.mutate(undefined)}
            disabled={actions.resolve.isPending || !t || t.status === 'RESOLVED'}
          >
            Mark resolved
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => actions.escalate.mutate({ level: (t?.escalationLevel ?? 0) + 1 })}
            disabled={actions.escalate.isPending}
          >
            Escalate
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => actions.close.mutate(undefined)}
            disabled={actions.close.isPending || !t || t.status === 'CLOSED'}
          >
            Close
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-4">
        {/* Main column */}
        <main className="col-span-12 lg:col-span-8">
          <Tabs defaultValue="thread">
            <TabsList>
              <TabsTrigger value="thread">
                <MessageSquare className="size-3.5" />
                Thread
              </TabsTrigger>
              <TabsTrigger value="activity">
                <PenSquare className="size-3.5" />
                Activity
              </TabsTrigger>
            </TabsList>
            <TabsContent value="thread" className="space-y-3">
              <div className="rounded-md border bg-card">
                <div className="max-h-[55vh] overflow-y-auto p-3">
                  {messages.isLoading ? (
                    <Skeleton className="h-32 w-full" />
                  ) : !messages.data || messages.data.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground">No messages yet.</p>
                  ) : (
                    <ul className="space-y-3">
                      {messages.data.map((m) => (
                        <li
                          key={m.id}
                          className={`rounded-md border p-3 ${
                            m.isInternal
                              ? 'border-amber-200 bg-amber-50'
                              : m.authorKind === 'CUSTOMER'
                                ? 'border-muted bg-muted/40'
                                : 'border-primary/30 bg-primary/5'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="flex items-center gap-1 font-medium">
                              <UserCircle className="size-3.5" />
                              {m.author
                                ? `${m.author.firstName ?? ''} ${m.author.lastName ?? ''}`.trim()
                                : m.authorKind}
                              {m.isInternal ? (
                                <Badge variant="outline" className="ml-2">
                                  Internal
                                </Badge>
                              ) : null}
                            </span>
                            <span>{formatDateTime(m.createdAt)}</span>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm">{m.body}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="border-t p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs">
                    <span>Reply via</span>
                    <select
                      className="rounded-md border bg-background px-2 py-1"
                      value={channel}
                      onChange={(e) => setChannel(e.target.value as ConversationChannel)}
                      disabled={internal}
                    >
                      <option value="WHATSAPP">WhatsApp</option>
                      <option value="EMAIL">Email</option>
                      <option value="SMS">SMS</option>
                      <option value="IN_APP_CHAT">In-app chat</option>
                      <option value="WEB_CHAT">Web chat</option>
                    </select>
                    <label className="ml-auto flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={internal}
                        onChange={(e) => setInternal(e.target.checked)}
                      />
                      Internal note
                    </label>
                  </div>
                  <textarea
                    className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder={internal ? 'Add an internal note…' : 'Type your reply…'}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                  <div className="mt-2 flex justify-end">
                    <Button
                      onClick={submit}
                      disabled={
                        actions.addNote.isPending || actions.reply.isPending || !draft.trim()
                      }
                    >
                      <Send className="size-4" />
                      {internal ? 'Add note' : 'Send reply'}
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="activity">
              {activities.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : !activities.data || activities.data.length === 0 ? (
                <EmptyState title="No activity" description="Nothing has happened on this ticket yet." />
              ) : (
                <ol className="space-y-2">
                  {activities.data.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-start gap-2 rounded-md border bg-card p-3 text-sm"
                    >
                      <Clock className="mt-0.5 size-4 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="text-sm">
                          <strong>
                            {a.actor
                              ? `${a.actor.firstName ?? ''} ${a.actor.lastName ?? ''}`.trim() ||
                                'System'
                              : 'System'}
                          </strong>{' '}
                          — {a.type.replace('_', ' ').toLowerCase()}
                          {a.message ? <span className="text-muted-foreground"> · {a.message}</span> : null}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {formatDateTime(a.createdAt)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </TabsContent>
          </Tabs>
        </main>

        {/* Sidebar: customer context */}
        <aside className="col-span-12 space-y-3 lg:col-span-4">
          <section className="rounded-md border bg-card p-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Ticket meta
            </h2>
            <dl className="mt-2 space-y-1 text-sm">
              <Row label="Source">{t?.source.replace('_', ' ') ?? '—'}</Row>
              <Row label="Assigned">
                {t?.assignedAgent
                  ? `${t.assignedAgent.firstName ?? ''} ${t.assignedAgent.lastName ?? ''}`.trim()
                  : 'Unassigned'}
              </Row>
              <Row label="Team">{t?.assignedTeam ?? '—'}</Row>
              <Row label="SLA">{t?.slaProfile?.name ?? 'Default'}</Row>
              <Row label="First response">
                {t?.firstResponseAt
                  ? formatDateTime(t.firstResponseAt)
                  : t?.firstResponseDueAt
                    ? `due ${formatDate(t.firstResponseDueAt)}`
                    : '—'}
              </Row>
              <Row label="Resolution">
                {t?.resolvedAt
                  ? formatDateTime(t.resolvedAt)
                  : t?.resolutionDueAt
                    ? `due ${formatDate(t.resolutionDueAt)}`
                    : '—'}
              </Row>
              {t?.satisfactionRating ? (
                <Row label="CSAT">
                  <span className="inline-flex items-center gap-1">
                    <Star className="size-3 text-amber-500" />
                    {t.satisfactionRating} / 5
                  </span>
                </Row>
              ) : null}
              {t?.tags?.length ? (
                <Row label="Tags">
                  <span className="space-x-1">
                    {t.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="gap-1">
                        <Tag className="size-3" />
                        {tag}
                      </Badge>
                    ))}
                  </span>
                </Row>
              ) : null}
            </dl>
          </section>

          <CustomerContextCard ctx={context.data} loading={context.isLoading} />
        </aside>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm">{children}</dd>
    </div>
  );
}

function CustomerContextCard({
  ctx,
  loading,
}: {
  ctx: ReturnType<typeof useTicketCustomerContext>['data'];
  loading: boolean;
}) {
  if (loading) return <Skeleton className="h-48 w-full" />;
  if (!ctx) return null;
  const cust = ctx.customer as {
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    fullName?: string;
  } | null;
  return (
    <section className="rounded-md border bg-card p-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Customer
      </h2>
      {cust ? (
        <div className="mt-2 space-y-2 text-sm">
          <div className="font-medium">
            {cust.fullName ?? `${cust.firstName ?? ''} ${cust.lastName ?? ''}`.trim()}
          </div>
          <div className="text-xs text-muted-foreground">
            {cust.phone} · {cust.email ?? 'no email'}
          </div>
          <div className="rounded-md border bg-muted/40 p-2 text-xs">
            <div className="flex items-center justify-between">
              <span>Value score</span>
              <span className="font-semibold">{ctx.valueScore.toFixed(0)}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Stat label="Bookings" value={ctx.bookings.length} />
            <Stat label="AMC plans" value={ctx.amcSubscriptions.length} />
            <Stat label="Invoices" value={ctx.invoices.length} />
            <Stat label="Past tickets" value={ctx.tickets.length} />
          </div>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">Unknown / walk-in customer.</p>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-card p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
