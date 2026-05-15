'use client';

import * as React from 'react';
import {
  Inbox as InboxIcon,
  MessageCircle,
  Phone,
  Mail,
  MessageSquare,
  Globe,
  Smartphone,
  Send,
  RefreshCcw,
  Loader2,
} from 'lucide-react';

import {
  Badge,
  Button,
  EmptyState,
  Input,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@ac/ui';

import {
  useConversation,
  useConversationActions,
  useConversationMessages,
  useConversations,
} from '@/hooks/use-support';
import type {
  ConversationChannel,
  ConversationMessage,
  ConversationStatus,
  ConversationSummary,
  MessageStatus,
} from '@/lib/api/support';
import { formatDateTime } from '@/lib/format';

const CHANNEL_ICONS: Record<ConversationChannel, React.ReactNode> = {
  WHATSAPP: <MessageCircle className="size-3.5 text-green-600" />,
  EMAIL: <Mail className="size-3.5" />,
  PHONE: <Phone className="size-3.5" />,
  WEB_CHAT: <Globe className="size-3.5" />,
  IN_APP_CHAT: <Smartphone className="size-3.5" />,
  SMS: <MessageSquare className="size-3.5" />,
  SOCIAL: <MessageCircle className="size-3.5" />,
};

const STATUS_TABS: Array<{ id: 'all' | ConversationStatus; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'OPEN', label: 'Open' },
  { id: 'PENDING', label: 'Pending' },
  { id: 'WAITING_CUSTOMER', label: 'Waiting' },
  { id: 'RESOLVED', label: 'Resolved' },
];

export default function InboxPage() {
  const [status, setStatus] = React.useState<'all' | ConversationStatus>('OPEN');
  const [channel, setChannel] = React.useState<ConversationChannel | 'all'>('all');
  const [search, setSearch] = React.useState('');
  const [selected, setSelected] = React.useState<string | null>(null);

  const conversations = useConversations({
    page: 1,
    pageSize: 50,
    search: search || undefined,
    status: status === 'all' ? undefined : [status],
    channel: channel === 'all' ? undefined : [channel],
  });
  const items = (conversations.data?.items ?? []) as ConversationSummary[];

  React.useEffect(() => {
    if (!selected && items.length > 0 && items[0]) setSelected(items[0].id);
  }, [items, selected]);

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <InboxIcon className="size-5" />
            Omnichannel inbox
          </h1>
          <p className="text-sm text-muted-foreground">
            One unified queue for WhatsApp, email, phone, web chat, in-app and SMS.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search messages…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-72"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => conversations.refetch()}
            disabled={conversations.isFetching}
          >
            <RefreshCcw className="size-4" />
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-3">
        {/* List */}
        <aside className="col-span-12 lg:col-span-4 xl:col-span-3">
          <Tabs value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <TabsList className="grid w-full grid-cols-5">
              {STATUS_TABS.map((s) => (
                <TabsTrigger key={s.id} value={s.id} className="text-xs">
                  {s.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="mt-2 flex flex-wrap gap-1">
            {(['all', 'WHATSAPP', 'EMAIL', 'PHONE', 'WEB_CHAT', 'IN_APP_CHAT', 'SMS'] as const).map(
              (c) => (
                <Button
                  key={c}
                  size="sm"
                  variant={channel === c ? 'default' : 'outline'}
                  className="h-7 px-2 text-xs"
                  onClick={() => setChannel(c)}
                >
                  {c === 'all' ? 'All' : c.replace('_', ' ')}
                </Button>
              ),
            )}
          </div>

          <div className="mt-3 max-h-[70vh] overflow-y-auto rounded-md border">
            {conversations.isLoading ? (
              <Skeleton className="h-72 w-full" />
            ) : items.length === 0 ? (
              <EmptyState title="No conversations" description="Inbox is empty." />
            ) : (
              <ul className="divide-y">
                {items.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(c.id)}
                      className={`block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50 ${
                        selected === c.id ? 'bg-muted' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 font-medium">
                          {CHANNEL_ICONS[c.channel]}
                          {c.customer?.fullName ?? 'Unknown'}
                        </span>
                        {c.unreadAgentCount > 0 ? (
                          <Badge variant="destructive">{c.unreadAgentCount}</Badge>
                        ) : null}
                      </div>
                      <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                        {c.subject ?? c.ticket?.number ?? '—'}
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        {c.lastMessageAt ? formatDateTime(c.lastMessageAt) : ''}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Thread */}
        <section className="col-span-12 lg:col-span-8 xl:col-span-9">
          {selected ? (
            <ConversationDetail id={selected} />
          ) : (
            <div className="flex h-[60vh] items-center justify-center rounded-md border bg-muted/30 text-sm text-muted-foreground">
              Select a conversation to start
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ConversationDetail({ id }: { id: string }) {
  const detail = useConversation(id);
  const messages = useConversationMessages(id, { limit: 100 });
  const actions = useConversationActions(id);
  const [draft, setDraft] = React.useState('');
  const [template, setTemplate] = React.useState('');
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    actions.read.mutate({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.data?.items.length]);

  const c = detail.data;
  const items = messages.data?.items ?? [];

  const send = () => {
    if (!c) return;
    const channel = c.channel;
    if (channel === 'WHATSAPP' && !draft.trim() && !template.trim()) return;
    if (channel !== 'WHATSAPP' && !draft.trim()) return;
    actions.send.mutate(
      { body: draft, channel, templateName: template || undefined },
      {
        onSuccess: () => {
          setDraft('');
          setTemplate('');
          messages.refetch();
        },
      },
    );
  };

  return (
    <div className="grid grid-rows-[auto_1fr_auto] rounded-md border bg-card">
      {/* Header */}
      <header className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          {c ? CHANNEL_ICONS[c.channel] : null}
          <div>
            <div className="text-sm font-medium">
              {c?.customer?.fullName ?? 'Unknown customer'}
            </div>
            <div className="text-xs text-muted-foreground">
              {c?.customer?.phone ?? c?.customer?.email ?? ''}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {c?.ticket ? (
            <Badge variant="outline">Ticket {c.ticket.number}</Badge>
          ) : null}
          {c?.status ? <Badge>{c.status.replace('_', ' ')}</Badge> : null}
          <Button
            size="sm"
            variant="outline"
            onClick={() => actions.close.mutate()}
            disabled={actions.close.isPending}
          >
            Close
          </Button>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="max-h-[60vh] space-y-3 overflow-y-auto px-4 py-3">
        {messages.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : items.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">No messages yet.</p>
        ) : (
          items.map((m) => <Bubble key={m.id} m={m} />)
        )}
      </div>

      {/* Composer */}
      <div className="border-t px-4 py-2">
        {c?.channel === 'WHATSAPP' ? (
          <div className="mb-2">
            <Input
              placeholder="WhatsApp template name (e.g. ac_followup) — optional"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="text-xs"
            />
          </div>
        ) : null}
        <div className="flex items-end gap-2">
          <textarea
            className="flex min-h-[64px] flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Type a reply… (Cmd/Ctrl + Enter to send)"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                send();
              }
            }}
          />
          <Button onClick={send} disabled={actions.send.isPending}>
            {actions.send.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}

const STATUS_COLOUR: Record<MessageStatus, string> = {
  QUEUED: 'text-muted-foreground',
  SENT: 'text-muted-foreground',
  DELIVERED: 'text-blue-600',
  READ: 'text-emerald-600',
  FAILED: 'text-destructive',
};

function Bubble({ m }: { m: ConversationMessage }) {
  const isOutbound = m.direction === 'OUTBOUND';
  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
          isOutbound
            ? 'bg-primary text-primary-foreground'
            : 'border bg-muted text-foreground'
        }`}
      >
        <div className="whitespace-pre-wrap break-words">{m.body}</div>
        <div
          className={`mt-1 flex items-center gap-2 text-[10px] ${
            isOutbound ? 'text-primary-foreground/80' : 'text-muted-foreground'
          }`}
        >
          <span>{formatDateTime(m.createdAt)}</span>
          {isOutbound ? <span className={STATUS_COLOUR[m.status]}>· {m.status}</span> : null}
        </div>
      </div>
    </div>
  );
}
