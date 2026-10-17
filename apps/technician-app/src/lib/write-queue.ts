/**
 * AsyncStorage-backed offline write queue for field writes (job-card
 * patches, photo uploads, customer signature). Mirrors the location ping
 * queue in `location.ts`: persist first, flush best-effort on every enqueue,
 * on a 30s timer (see app/_layout.tsx) and from the home-screen sync button.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import { apiStatus, isNetworkError } from './api';
import { repairApi } from './repair-api';
import { technicianApi } from './technician-api';
import { discardPendingFile, uploadLocalFile } from './upload';
import {
  appendWrite,
  classifyFailure,
  type NewWrite,
  type QueuedWrite,
  trimWrites,
  withoutJobCardPatch,
} from './write-queue-core';

const QUEUE_KEY = 'ac.tech.writeQueue';

type Listener = (queue: QueuedWrite[]) => void;
const listeners = new Set<Listener>();
let flushing: Promise<FlushResult> | null = null;

export interface FlushResult {
  flushed: number;
  remaining: number;
  dropped: number;
}

export async function readWriteQueue(): Promise<QueuedWrite[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as QueuedWrite[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: QueuedWrite[]): Promise<void> {
  const trimmed = trimWrites(items);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(trimmed));
  for (const l of listeners) l(trimmed);
}

export function subscribeWriteQueue(listener: Listener): () => void {
  listeners.add(listener);
  void readWriteQueue().then(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function enqueueWrite(write: NewWrite): Promise<void> {
  const queue = await readWriteQueue();
  await writeQueue(appendWrite(queue, write, { id: Crypto.randomUUID(), now: new Date().toISOString() }));
}

/** Called after a successful direct save so a stale queued patch can't overwrite it. */
export async function dropQueuedJobCardPatch(bookingId: string): Promise<void> {
  const queue = await readWriteQueue();
  const next = withoutJobCardPatch(queue, bookingId);
  if (next.length !== queue.length) await writeQueue(next);
}

async function perform(w: QueuedWrite): Promise<void> {
  switch (w.kind) {
    case 'jobcard.patch':
      await repairApi.saveJobCard(w.bookingId, w.patch);
      return;
    case 'photo.upload': {
      const up = await uploadLocalFile({ localUri: w.localUri, contentType: w.contentType });
      await technicianApi.addAttachment(w.bookingId, {
        kind: w.attachmentKind,
        url: up.publicUrl,
        storageKey: up.storageKey,
        mimeType: up.contentType,
        ...(up.sizeBytes ? { sizeBytes: up.sizeBytes } : {}),
        ...(w.caption ? { caption: w.caption } : {}),
      });
      await discardPendingFile(w.localUri);
      return;
    }
    case 'signature.upload': {
      const up = await uploadLocalFile({ localUri: w.localUri, contentType: 'image/png' });
      await technicianApi.setSignature(w.bookingId, up.publicUrl);
      await discardPendingFile(w.localUri);
      return;
    }
  }
}

async function doFlush(): Promise<FlushResult> {
  let queue = await readWriteQueue();
  let flushed = 0;
  let dropped = 0;
  const kept: QueuedWrite[] = [];
  for (let i = 0; i < queue.length; i += 1) {
    const w = queue[i]!;
    try {
      await perform(w);
      flushed += 1;
    } catch (err) {
      if (isNetworkError(err)) {
        // Offline — keep this and everything after it, stop for now.
        kept.push(...queue.slice(i));
        break;
      }
      const outcome = classifyFailure(apiStatus(err), w.attempts);
      if (outcome === 'failed') dropped += 1;
      else kept.push({ ...w, attempts: apiStatus(err) === 404 ? w.attempts : w.attempts + 1 });
    }
  }
  // Re-read so writes enqueued (or coalesced into an existing entry) while
  // we were flushing aren't lost.
  const snapshot = new Map(queue.map((q) => [q.id, JSON.stringify(q)]));
  const keptById = new Map(kept.map((q) => [q.id, q]));
  const latest = await readWriteQueue();
  queue = latest.flatMap((q) => {
    const snap = snapshot.get(q.id);
    if (snap == null) return [q];
    const changed = JSON.stringify(q) !== snap;
    const k = keptById.get(q.id);
    if (k) return [changed ? { ...q, attempts: k.attempts } : k];
    return changed ? [q] : [];
  });
  await writeQueue(queue);
  return { flushed, remaining: queue.length, dropped };
}

/** Serialised — concurrent callers share the in-flight flush. */
export function flushWriteQueue(): Promise<FlushResult> {
  flushing ??= doFlush().finally(() => {
    flushing = null;
  });
  return flushing;
}
