'use client';

import { Avatar, AvatarFallback } from '@ac/ui';
import { formatDistanceToNow } from 'date-fns';
import {
  Activity as ActivityIcon,
  AlertCircle,
  CheckCircle2,
  Circle,
  FileText,
  MessageSquare,
  Phone,
  Truck,
  UserCheck,
  Wrench,
  XCircle,
} from 'lucide-react';

interface TimelineEntry {
  id: string;
  type: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  message?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string | Date;
  actor?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
  } | null;
}

const ICONS: Record<string, typeof Circle> = {
  CREATED: Circle,
  STATUS_CHANGED: ActivityIcon,
  ASSIGNED: UserCheck,
  REASSIGNED: UserCheck,
  NOTE_ADDED: MessageSquare,
  FIELD_UPDATED: FileText,
  SCHEDULED: Phone,
  RESCHEDULED: Phone,
  TECHNICIAN_EN_ROUTE: Truck,
  ARRIVED_ON_SITE: Truck,
  OTP_SENT: MessageSquare,
  OTP_VERIFIED: CheckCircle2,
  WAITING_PARTS: AlertCircle,
  WORK_RESUMED: Wrench,
  COMPLETED: CheckCircle2,
  CANCELLED: XCircle,
  CONVERTED_TO_BOOKING: CheckCircle2,
  ATTACHMENT_ADDED: FileText,
  SIGNATURE_CAPTURED: FileText,
  PAYMENT_RECORDED: CheckCircle2,
};

export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No activity yet.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {entries.map((entry) => {
        const Icon = ICONS[entry.type] ?? Circle;
        const actorName = entry.actor
          ? [entry.actor.firstName, entry.actor.lastName].filter(Boolean).join(' ') || 'System'
          : 'System';
        return (
          <li key={entry.id} className="flex gap-3 rounded-md border bg-card p-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
              <Icon className="size-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {labelForType(entry.type)}
                </span>
                {entry.fromStatus && entry.toStatus ? (
                  <span className="text-xs text-muted-foreground">
                    {entry.fromStatus} → {entry.toStatus}
                  </span>
                ) : null}
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                </span>
              </div>
              {entry.message ? (
                <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{entry.message}</p>
              ) : null}
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Avatar className="size-5">
                  <AvatarFallback className="text-[9px]">
                    {actorName.split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
                <span>{actorName}</span>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function labelForType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
}
