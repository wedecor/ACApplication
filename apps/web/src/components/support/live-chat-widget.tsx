'use client';

import * as React from 'react';
import { MessageSquare, Minus, Send, X, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Visitor-facing live-chat widget.
 *
 * Talks to the support backend via two thin Next.js proxy routes
 * (`/api/web-chat/start`, `/api/web-chat/messages`) which forward to
 * `/api/v1/public/web-chat/*`. The proxy adds the tenant slug and
 * server-side rate limiting so the widget can stay completely
 * unauthenticated.
 *
 * Storage: the `sessionId` is persisted in `localStorage` under
 * `ac.web-chat.sid` so reloads keep the conversation glued.
 */

type Message = {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  body: string;
  createdAt: string;
};

const STORAGE_KEY = 'ac.web-chat.sid';

export function LiveChatWidget() {
  const [open, setOpen] = React.useState(false);
  const [minimised, setMinimised] = React.useState(false);
  const [started, setStarted] = React.useState(false);
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [draft, setDraft] = React.useState('');
  const [name, setName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const lastFetchedRef = React.useRef<string | null>(null);

  // Restore session from localStorage on mount.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing) {
      setSessionId(existing);
      setStarted(true);
    }
  }, []);

  // Poll for new messages every 5 seconds while open.
  React.useEffect(() => {
    if (!open || !sessionId || !started) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const after = lastFetchedRef.current;
        const url = new URL(
          `/api/web-chat/messages`,
          window.location.origin,
        );
        url.searchParams.set('sessionId', sessionId);
        if (after) url.searchParams.set('after', after);
        const r = await fetch(url.toString(), { cache: 'no-store' });
        if (!r.ok) return;
        const data = (await r.json()) as { items: Message[] };
        if (cancelled) return;
        if (data.items?.length) {
          setMessages((prev) => {
            const seen = new Set(prev.map((m) => m.id));
            const next = [...prev, ...data.items.filter((m) => !seen.has(m.id))];
            lastFetchedRef.current = next[next.length - 1]?.createdAt ?? after;
            return next;
          });
        }
      } catch {
        // Network blip — try again on the next tick.
      }
    };
    void tick();
    const id = window.setInterval(tick, 5_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [open, sessionId, started]);

  // Auto-scroll on new messages.
  React.useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages.length]);

  const start = async () => {
    setSending(true);
    setError(null);
    try {
      const r = await fetch('/api/web-chat/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name || undefined,
          phone: phone || undefined,
          initialMessage: draft || undefined,
        }),
      });
      if (!r.ok) throw new Error('Could not start chat');
      const data = (await r.json()) as { sessionId: string };
      window.localStorage.setItem(STORAGE_KEY, data.sessionId);
      setSessionId(data.sessionId);
      setStarted(true);
      if (draft.trim()) {
        setMessages([
          {
            id: 'local-' + Date.now(),
            direction: 'INBOUND',
            body: draft,
            createdAt: new Date().toISOString(),
          },
        ]);
      }
      setDraft('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSending(false);
    }
  };

  const send = async () => {
    if (!draft.trim() || !sessionId) return;
    const optimistic: Message = {
      id: 'local-' + Date.now(),
      direction: 'INBOUND',
      body: draft,
      createdAt: new Date().toISOString(),
    };
    setMessages((p) => [...p, optimistic]);
    setDraft('');
    setSending(true);
    try {
      await fetch('/api/web-chat/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId, body: optimistic.body }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Toggle button */}
      <button
        type="button"
        aria-label="Open support chat"
        onClick={() => {
          setOpen(true);
          setMinimised(false);
        }}
        className={cn(
          'fixed bottom-6 right-6 z-30 hidden h-12 w-12 items-center justify-center rounded-full bg-foreground text-background shadow-lg ring-1 ring-black/10 transition-transform hover:scale-105 active:scale-95 sm:flex',
          open && !minimised ? 'invisible' : 'visible',
        )}
      >
        <MessageSquare className="size-5" />
      </button>

      {/* Panel */}
      {open ? (
        <div
          className={cn(
            'fixed bottom-6 right-6 z-40 w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-xl border bg-background shadow-2xl transition-transform',
            minimised ? 'h-12' : 'h-[560px] max-h-[80vh]',
          )}
        >
          {/* Header */}
          <header className="flex h-12 items-center justify-between border-b bg-foreground px-3 text-background">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MessageSquare className="size-4" />
              We&apos;re online — say hi!
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Minimise"
                onClick={() => setMinimised((p) => !p)}
                className="rounded p-1 hover:bg-white/10"
              >
                <Minus className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="rounded p-1 hover:bg-white/10"
              >
                <X className="size-4" />
              </button>
            </div>
          </header>

          {minimised ? null : !started ? (
            <div className="flex h-[calc(100%-3rem)] flex-col p-4">
              <p className="text-sm">
                Hi! Tell us a little so the right agent can help you.
              </p>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="mt-3 rounded-md border bg-background px-3 py-2 text-sm"
              />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 phone"
                inputMode="tel"
                className="mt-2 rounded-md border bg-background px-3 py-2 text-sm"
              />
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="What can we help with?"
                className="mt-2 min-h-[100px] flex-1 rounded-md border bg-background px-3 py-2 text-sm"
              />
              {error ? (
                <p className="mt-2 text-xs text-destructive">{error}</p>
              ) : null}
              <button
                type="button"
                onClick={start}
                disabled={sending}
                className="mt-3 inline-flex items-center justify-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
              >
                {sending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Start chat
              </button>
              <p className="mt-2 text-[10px] text-muted-foreground">
                Honest expectation: we usually reply within a few minutes during
                business hours.
              </p>
            </div>
          ) : (
            <div className="flex h-[calc(100%-3rem)] flex-col">
              <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-3">
                {messages.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground">
                    Connected. An agent will be with you shortly.
                  </p>
                ) : (
                  messages.map((m) => <Bubble key={m.id} message={m} />)
                )}
              </div>
              <div className="border-t p-2">
                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    rows={2}
                    placeholder="Type a message…"
                    className="min-h-[44px] flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={send}
                    disabled={sending || !draft.trim()}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-foreground text-background hover:opacity-90 disabled:opacity-50"
                  >
                    {sending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}

function Bubble({ message }: { message: Message }) {
  const isVisitor = message.direction === 'INBOUND';
  return (
    <div className={cn('flex', isVisitor ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm',
          isVisitor
            ? 'bg-foreground text-background'
            : 'border bg-muted text-foreground',
        )}
      >
        {message.body}
      </div>
    </div>
  );
}
