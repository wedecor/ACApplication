'use client';

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

import { humanizeEnum } from '@/lib/labels';

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
    return <p className="py-8 text-center text-sm text-muted-foreground">No activity yet.</p>;
  }

  return (
    <ol className="relative space-y-5 before:absolute before:bottom-2 before:left-4 before:top-2 before:w-px before:bg-border">
      {entries.map((entry) => {
        const Icon = ICONS[entry.type] ?? Circle;
        const actorName = entry.actor
          ? [entry.actor.firstName, entry.actor.lastName].filter(Boolean).join(' ') || 'System'
          : 'System';
        const at = new Date(entry.createdAt);
        return (
          <li key={entry.id} className="relative flex gap-3">
            <div className="z-10 flex size-8 shrink-0 items-center justify-center rounded-full border bg-card">
              <Icon className="size-4 text-muted-foreground" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium">{labelForType(entry.type)}</span>
                <time
                  dateTime={at.toISOString()}
                  title={at.toLocaleString('en-IN')}
                  className="shrink-0 text-xs text-muted-foreground"
                >
                  {formatDistanceToNow(at, { addSuffix: true })}
                </time>
              </div>
              {entry.fromStatus && entry.toStatus ? (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {humanizeEnum(entry.fromStatus)} → <span className="text-foreground">{humanizeEnum(entry.toStatus)}</span>
                </p>
              ) : null}
              {entry.message ? (
                <p className="mt-0.5 line-clamp-3 text-sm text-muted-foreground">{entry.message}</p>
              ) : null}
              <p className="mt-1 text-xs text-muted-foreground">{actorName}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const ACRONYMS = /\b(Otp|Sla|Amc|Gst)\b/g;

function labelForType(type: string): string {
  return humanizeEnum(type).replace(ACRONYMS, (m) => m.toUpperCase());
}
