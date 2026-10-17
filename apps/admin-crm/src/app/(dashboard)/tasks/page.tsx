'use client';

import {
  Badge,
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
import { CheckCircle2, ListTodo, Pencil, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';

import { Field, NativeSelect, StatCard, TextArea } from '@/components/common/form-field';
import { Pagination } from '@/components/common/pagination';
import { SimpleModal } from '@/components/common/simple-modal';
import { useCompleteTask, useDeleteTask, useSaveTask, useTasks, useTaskSummary } from '@/hooks/use-tasks';
import {
  type Task,
  TASK_ENTITY_TYPES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskEntityType,
  type TaskInput,
  type TaskListQuery,
  type TaskPriority,
  type TaskStatus,
} from '@/lib/api/tasks';
import { errorMessage, formatDateTime, isoToLocalInput, localInputToIso } from '@/lib/crm-format';
import { humanizeEnum } from '@/lib/labels';

const PRIORITY_VARIANT: Record<TaskPriority, 'muted' | 'info' | 'warning' | 'destructive'> = {
  LOW: 'muted',
  NORMAL: 'info',
  HIGH: 'warning',
  URGENT: 'destructive',
};

const ENTITY_ROUTE: Partial<Record<TaskEntityType, string>> = {
  lead: '/leads',
  customer: '/customers',
  booking: '/bookings',
  ticket: '/tickets',
  opportunity: '/opportunities',
  account: '/accounts',
};

function isOpen(t: Task) {
  return t.status === 'OPEN' || t.status === 'IN_PROGRESS';
}

function dueState(t: Task): 'overdue' | 'today' | null {
  if (!t.dueAt || !isOpen(t)) return null;
  const due = new Date(t.dueAt);
  const now = new Date();
  if (due.getTime() < now.getTime()) return 'overdue';
  if (due.toDateString() === now.toDateString()) return 'today';
  return null;
}

function assigneeName(t: Task): string {
  const a = t.assignee;
  if (!a) return t.assigneeUserId ? 'Unknown user' : 'Unassigned';
  return [a.firstName, a.lastName].filter(Boolean).join(' ') || a.email || 'User';
}

export default function TasksPage() {
  const [query, setQuery] = React.useState<TaskListQuery>({ page: 1, pageSize: 20, scope: 'mine' });
  const [draft, setDraft] = React.useState('');
  const { data, isLoading, error } = useTasks(query);
  const { data: summary } = useTaskSummary();
  const complete = useCompleteTask();
  const del = useDeleteTask();
  const [editing, setEditing] = React.useState<Task | 'new' | null>(null);
  const items = data?.items ?? [];

  const tab = (scope: 'mine' | 'all', label: string) => (
    <button
      type="button"
      onClick={() => setQuery((q) => ({ ...q, page: 1, scope }))}
      className={`rounded-md px-3 py-1.5 text-sm ${query.scope === scope ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">Follow-ups linked to leads, customers, bookings, tickets and deals.</p>
        </div>
        <Button onClick={() => setEditing('new')}>
          <Plus className="mr-1 size-4" /> New task
        </Button>
      </header>

      {summary ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="My open" value={summary.mineOpen} />
          <StatCard label="Due today" value={summary.dueToday} />
          <StatCard label="Overdue" value={summary.overdue} />
          <StatCard label="All open" value={summary.open} />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <form
          role="search"
          className="flex w-full gap-2 sm:order-last sm:w-auto"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery((q) => ({ ...q, page: 1, search: draft.trim() || undefined }));
          }}
        >
          <Input
            type="search"
            aria-label="Search tasks"
            className="min-w-0 flex-1 sm:w-56"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search tasks"
          />
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>
        <div className="flex gap-1 rounded-lg border p-1">
          {tab('mine', 'My tasks')}
          {tab('all', 'All tasks')}
        </div>
        <NativeSelect
          className="w-40"
          aria-label="Status"
          value={query.status ?? ''}
          onChange={(e) => setQuery((q) => ({ ...q, page: 1, status: (e.target.value || undefined) as TaskStatus | undefined }))}
        >
          <option value="">Any status</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {humanizeEnum(s)}
            </option>
          ))}
        </NativeSelect>
        <label className="flex h-10 items-center gap-2 text-sm">
          <input
            className="size-4 accent-primary"
            type="checkbox"
            checked={Boolean(query.overdue)}
            onChange={(e) => setQuery((q) => ({ ...q, page: 1, overdue: e.target.checked || undefined }))}
          />
          Overdue only
        </label>
      </div>

      {error ? (
        <p className="text-sm text-destructive">{errorMessage(error, 'Failed to load tasks')}</p>
      ) : isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : items.length === 0 ? (
        <EmptyState icon={ListTodo} title="No tasks" description="Nothing here. Create a task to track a follow-up." />
      ) : (
        <>
          <div className="rounded-lg border">
            <Table stackOnMobile>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Linked to</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((t) => {
                  const due = dueState(t);
                  const route = t.entityType ? ENTITY_ROUTE[t.entityType] : undefined;
                  return (
                    <TableRow key={t.id}>
                      <TableCell>
                        <p className={`font-medium ${isOpen(t) ? '' : 'text-muted-foreground line-through'}`}>{t.title}</p>
                        {t.description ? <p className="line-clamp-1 text-xs text-muted-foreground">{t.description}</p> : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant={PRIORITY_VARIANT[t.priority]}>{humanizeEnum(t.priority)}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {t.dueAt ? formatDateTime(t.dueAt) : '—'}
                        {due === 'overdue' ? (
                          <Badge variant="destructive" className="ml-1">
                            Overdue
                          </Badge>
                        ) : due === 'today' ? (
                          <Badge variant="warning" className="ml-1">
                            Today
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-xs">
                        {t.entityType && t.entityId ? (
                          route ? (
                            <Link href={`${route}/${t.entityId}`} className="text-primary hover:underline">
                              {humanizeEnum(t.entityType)}
                            </Link>
                          ) : (
                            humanizeEnum(t.entityType)
                          )
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{assigneeName(t)}</TableCell>
                      <TableCell className="text-sm">{humanizeEnum(t.status)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        {isOpen(t) ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Mark done"
                            disabled={complete.isPending}
                            onClick={() =>
                              complete.mutate(t.id, {
                                onSuccess: () => toast.success('Task completed'),
                                onError: (err) => toast.error(errorMessage(err)),
                              })
                            }
                          >
                            <CheckCircle2 className="size-4" />
                          </Button>
                        ) : null}
                        <Button size="sm" variant="ghost" title="Edit" onClick={() => setEditing(t)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Delete"
                          disabled={del.isPending}
                          onClick={() => {
                            if (window.confirm('Delete this task?')) {
                              del.mutate(t.id, { onError: (err) => toast.error(errorMessage(err)) });
                            }
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {data?.pagination ? (
            <Pagination {...data.pagination} onPageChange={(page) => setQuery((q) => ({ ...q, page }))} />
          ) : null}
        </>
      )}

      <TaskModal key={editing === 'new' ? 'new' : editing?.id ?? 'closed'} task={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function TaskModal({ task, onClose }: { task: Task | 'new' | null; onClose: () => void }) {
  const existing = task && task !== 'new' ? task : null;
  const save = useSaveTask();
  const [title, setTitle] = React.useState(existing?.title ?? '');
  const [description, setDescription] = React.useState(existing?.description ?? '');
  const [priority, setPriority] = React.useState<TaskPriority>(existing?.priority ?? 'NORMAL');
  const [status, setStatus] = React.useState<TaskStatus>(existing?.status ?? 'OPEN');
  const [dueAt, setDueAt] = React.useState(isoToLocalInput(existing?.dueAt));
  const [reminderAt, setReminderAt] = React.useState(isoToLocalInput(existing?.reminderAt));
  const [assigneeUserId, setAssignee] = React.useState(existing?.assigneeUserId ?? '');
  const [entityType, setEntityType] = React.useState<TaskEntityType | ''>(existing?.entityType ?? '');
  const [entityId, setEntityId] = React.useState(existing?.entityId ?? '');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (entityType && !entityId.trim()) {
      toast.error('Enter the id of the linked record');
      return;
    }
    const input: TaskInput = {
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      dueAt: localInputToIso(dueAt) ?? null,
      reminderAt: localInputToIso(reminderAt) ?? null,
      assigneeUserId: assigneeUserId.trim() || undefined,
      ...(entityType ? { entityType, entityId: entityId.trim() } : {}),
      ...(existing ? { status } : {}),
    };
    try {
      await save.mutateAsync({ id: existing?.id, input });
      toast.success(existing ? 'Task updated' : 'Task created');
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <SimpleModal open={task !== null} onOpenChange={(o) => !o && onClose()} title={existing ? 'Edit task' : 'New task'}>
      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
        <Field label="Title" className="sm:col-span-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} />
        </Field>
        <Field label="Description" className="sm:col-span-2">
          <TextArea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Priority">
          <NativeSelect value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {existing ? (
          <Field label="Status">
            <NativeSelect value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace('_', ' ')}
                </option>
              ))}
            </NativeSelect>
          </Field>
        ) : (
          <Field label="Assignee user id" hint="Blank = assign to me">
            <Input value={assigneeUserId} onChange={(e) => setAssignee(e.target.value)} />
          </Field>
        )}
        <Field label="Due">
          <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
        </Field>
        <Field label="Remind me at" hint="Sends an in-app/push reminder">
          <Input type="datetime-local" value={reminderAt} onChange={(e) => setReminderAt(e.target.value)} />
        </Field>
        <Field label="Linked record type">
          <NativeSelect value={entityType} onChange={(e) => setEntityType(e.target.value as TaskEntityType | '')}>
            <option value="">— None —</option>
            {TASK_ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Linked record id">
          <Input value={entityId} onChange={(e) => setEntityId(e.target.value)} disabled={!entityType} />
        </Field>
        {existing ? (
          <Field label="Assignee user id" className="sm:col-span-2">
            <Input value={assigneeUserId} onChange={(e) => setAssignee(e.target.value)} />
          </Field>
        ) : null}
        <ModalFooter className="sm:col-span-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            Save
          </Button>
        </ModalFooter>
      </form>
    </SimpleModal>
  );
}
