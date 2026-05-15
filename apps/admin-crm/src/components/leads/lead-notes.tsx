'use client';

import { Avatar, AvatarFallback, Button, Input } from '@ac/ui';
import { formatDistanceToNow } from 'date-fns';
import { Send } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { useAddLeadNote, useLeadNotes } from '@/hooks/use-leads';

export function LeadNotes({ id }: { id: string }) {
  const { data: notes = [] } = useLeadNotes(id);
  const { mutateAsync, isPending } = useAddLeadNote(id);
  const [body, setBody] = React.useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    try {
      await mutateAsync(body.trim());
      setBody('');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="space-y-3">
      <form onSubmit={submit} className="flex gap-2">
        <Input
          placeholder="Add a note…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <Button type="submit" disabled={isPending || !body.trim()}>
          <Send className="size-4" />
        </Button>
      </form>
      <ul className="space-y-2">
        {notes.map((n) => {
          const author = (n as unknown as {
            author?: { firstName: string | null; lastName: string | null };
          }).author;
          const initials = author
            ? `${author.firstName?.[0] ?? ''}${author.lastName?.[0] ?? ''}`.toUpperCase()
            : '?';
          return (
            <li key={n.id} className="rounded-md border bg-card p-3">
              <div className="flex items-center gap-2">
                <Avatar className="size-6">
                  <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium">
                  {[author?.firstName, author?.lastName].filter(Boolean).join(' ') || 'System'}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                </span>
              </div>
              <p className="mt-1 text-sm">{n.body}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
