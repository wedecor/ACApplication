/**
 * Pure core of the offline write queue (see `write-queue.ts` for the
 * AsyncStorage-backed runtime). Same philosophy as the location ping queue:
 * persist first, flush best-effort, cap the size so a long offline stretch
 * can't grow storage unbounded.
 *
 * Job-card patches for the same booking are coalesced so a technician who
 * edits 40 fields offline produces ONE PUT when the signal comes back.
 */
import type { JobCardPatch } from './repair-types';

export const MAX_WRITE_QUEUE = 200;
/** Give up on a write after this many non-network failures (4xx/5xx). */
export const MAX_WRITE_ATTEMPTS = 5;

export type AttachmentKind = 'PRE_SERVICE_PHOTO' | 'POST_SERVICE_PHOTO' | 'PARTS_PHOTO' | 'OTHER';

export type QueuedWrite =
  | {
      id: string;
      kind: 'jobcard.patch';
      bookingId: string;
      patch: JobCardPatch;
      createdAt: string;
      attempts: number;
    }
  | {
      id: string;
      kind: 'photo.upload';
      bookingId: string;
      localUri: string;
      contentType: string;
      attachmentKind: AttachmentKind;
      caption?: string;
      createdAt: string;
      attempts: number;
    }
  | {
      id: string;
      kind: 'signature.upload';
      bookingId: string;
      localUri: string;
      createdAt: string;
      attempts: number;
    };

/** Distributive Omit so each union member keeps its own fields. */
export type NewWrite = QueuedWrite extends infer W
  ? W extends QueuedWrite
    ? Omit<W, 'id' | 'createdAt' | 'attempts'>
    : never
  : never;

export function appendWrite(
  queue: readonly QueuedWrite[],
  write: NewWrite,
  meta: { id: string; now: string },
): QueuedWrite[] {
  if (write.kind === 'jobcard.patch') {
    const idx = queue.findIndex((q) => q.kind === 'jobcard.patch' && q.bookingId === write.bookingId);
    if (idx >= 0) {
      const prev = queue[idx] as Extract<QueuedWrite, { kind: 'jobcard.patch' }>;
      const merged: QueuedWrite = { ...prev, patch: { ...prev.patch, ...write.patch } };
      return queue.map((q, i) => (i === idx ? merged : q));
    }
  }
  if (write.kind === 'signature.upload') {
    // Only the latest signature matters.
    const filtered = queue.filter(
      (q) => !(q.kind === 'signature.upload' && q.bookingId === write.bookingId),
    );
    return trimWrites([...filtered, { ...write, id: meta.id, createdAt: meta.now, attempts: 0 }]);
  }
  return trimWrites([...queue, { ...write, id: meta.id, createdAt: meta.now, attempts: 0 }]);
}

export function trimWrites(items: QueuedWrite[]): QueuedWrite[] {
  return items.length > MAX_WRITE_QUEUE ? items.slice(items.length - MAX_WRITE_QUEUE) : items;
}

export type FlushOutcome = 'done' | 'retry-later' | 'failed';

/**
 * Classify a failed write:
 *   - no HTTP status (offline / timeout) → stop flushing, retry later;
 *   - 404 → endpoint not deployed yet → keep, retry later (don't lose data);
 *   - anything else → count an attempt, drop after MAX_WRITE_ATTEMPTS.
 */
export function classifyFailure(status: number | null, attempts: number): FlushOutcome {
  if (status == null) return 'retry-later';
  if (status === 404) return 'retry-later';
  return attempts + 1 >= MAX_WRITE_ATTEMPTS ? 'failed' : 'retry-later';
}

export function pendingForBooking(queue: readonly QueuedWrite[], bookingId: string): QueuedWrite[] {
  return queue.filter((q) => q.bookingId === bookingId);
}

/** Drop any queued job-card patch for a booking (a newer full save won). */
export function withoutJobCardPatch(queue: readonly QueuedWrite[], bookingId: string): QueuedWrite[] {
  return queue.filter((q) => !(q.kind === 'jobcard.patch' && q.bookingId === bookingId));
}
