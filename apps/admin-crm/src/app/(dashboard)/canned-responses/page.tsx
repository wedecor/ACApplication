'use client';

import * as React from 'react';
import { MessageSquare, Plus, Trash2 } from 'lucide-react';

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

import { useCannedActions, useCannedResponses } from '@/hooks/use-support';
import type { ConversationChannel } from '@/lib/api/support';

const CHANNELS: ConversationChannel[] = [
  'WHATSAPP',
  'EMAIL',
  'PHONE',
  'WEB_CHAT',
  'IN_APP_CHAT',
  'SMS',
];

export default function CannedResponsesPage() {
  const [search, setSearch] = React.useState('');
  const list = useCannedResponses({ search: search || undefined });
  const actions = useCannedActions();
  const [creating, setCreating] = React.useState(false);
  const [draft, setDraft] = React.useState({
    code: '',
    title: '',
    body: '',
    scope: 'GLOBAL' as 'GLOBAL' | 'TEAM' | 'PRIVATE',
    channels: [] as ConversationChannel[],
  });

  const toggleChannel = (ch: ConversationChannel) => {
    setDraft((d) =>
      d.channels.includes(ch)
        ? { ...d, channels: d.channels.filter((c) => c !== ch) }
        : { ...d, channels: [...d.channels, ch] },
    );
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <MessageSquare className="size-5" />
            Canned responses
          </h1>
          <p className="text-sm text-muted-foreground">
            Quick replies and macros that agents can drop into any conversation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <Button onClick={() => setCreating((p) => !p)}>
            <Plus className="size-4" />
            {creating ? 'Cancel' : 'New'}
          </Button>
        </div>
      </header>

      {creating ? (
        <div className="rounded-md border bg-card p-4">
          <h2 className="text-sm font-semibold">New canned response</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <Input
              placeholder="Code (e.g. /eta)"
              value={draft.code}
              onChange={(e) => setDraft({ ...draft, code: e.target.value })}
            />
            <Input
              placeholder="Title"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </div>
          <textarea
            className="mt-3 min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Body — supports {{customer.firstName}} placeholders"
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Channels:</span>
            {CHANNELS.map((ch) => (
              <Button
                key={ch}
                size="sm"
                variant={draft.channels.includes(ch) ? 'default' : 'outline'}
                onClick={() => toggleChannel(ch)}
              >
                {ch.replace('_', ' ')}
              </Button>
            ))}
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button
              disabled={!draft.code || !draft.title || !draft.body || actions.create.isPending}
              onClick={() =>
                actions.create.mutate(draft, {
                  onSuccess: () => {
                    setDraft({ code: '', title: '', body: '', scope: 'GLOBAL', channels: [] });
                    setCreating(false);
                  },
                })
              }
            >
              Save
            </Button>
          </div>
        </div>
      ) : null}

      {list.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : (list.data?.items.length ?? 0) === 0 ? (
        <EmptyState title="No canned responses" description="Create one to speed up replies." />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Channels</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data?.items.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.code}</TableCell>
                  <TableCell>{r.title}</TableCell>
                  <TableCell className="space-x-1">
                    {r.channels.length === 0 ? (
                      <span className="text-xs text-muted-foreground">Any</span>
                    ) : (
                      r.channels.map((c) => (
                        <Badge key={c} variant="outline">
                          {c.replace('_', ' ')}
                        </Badge>
                      ))
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{r.scope}</Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">{r.usageCount}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => actions.delete.mutate(r.id)}
                      disabled={actions.delete.isPending}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
