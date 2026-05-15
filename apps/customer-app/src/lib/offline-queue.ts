import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

import { api } from '@/lib/api-client';

/**
 * Naive offline action queue.
 *
 * Background: customer flows like rating a booking, adding a note, or
 * marking a notification read shouldn't fail loudly when the network
 * blips. We persist a tiny FIFO queue of intent-level mutations and
 * drain it whenever connectivity returns. UI shows optimistic state;
 * server reconciliation happens on the next foreground.
 *
 * The queue is intentionally simple: at-most-once delivery, no
 * conflict resolution. Use it only for idempotent or low-stakes
 * actions \u2014 bookings/payments still go through the regular request
 * path and fail visibly.
 */
const KEY = 'ac.customer.offline-queue.v1';

export type QueuedRequest = {
  id: string;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  enqueuedAt: number;
  retries: number;
};

let memoryQueue: QueuedRequest[] = [];
let hydrated = false;
let draining = false;

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(memoryQueue));
  } catch {
    /* ignore */
  }
}

export async function hydrateQueue(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return;
    memoryQueue = JSON.parse(raw) as QueuedRequest[];
  } catch {
    memoryQueue = [];
  }
}

export async function enqueue(req: Omit<QueuedRequest, 'id' | 'enqueuedAt' | 'retries'>): Promise<void> {
  await hydrateQueue();
  memoryQueue.push({
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    enqueuedAt: Date.now(),
    retries: 0,
    ...req,
  });
  await persist();
  void drain();
}

export async function drain(): Promise<void> {
  if (draining) return;
  await hydrateQueue();
  if (memoryQueue.length === 0) return;
  const net = await NetInfo.fetch();
  if (!net.isConnected || net.isInternetReachable === false) return;
  draining = true;
  try {
    while (memoryQueue.length > 0) {
      const next = memoryQueue[0]!;
      try {
        if (next.method === 'DELETE') {
          await api.delete(next.path);
        } else if (next.method === 'POST') {
          await api.post(next.path, next.body);
        } else if (next.method === 'PUT') {
          await api.put(next.path, next.body);
        } else {
          await api.patch(next.path, next.body);
        }
        memoryQueue.shift();
        await persist();
      } catch (err) {
        next.retries += 1;
        if (next.retries > 5) {
          // Drop after 5 attempts. Surface via telemetry rather than crash.
          // eslint-disable-next-line no-console
          console.warn('[offline-queue] dropping after retries', next, err);
          memoryQueue.shift();
          await persist();
        } else {
          await persist();
          break;
        }
      }
    }
  } finally {
    draining = false;
  }
}

export function startQueueDrainer(): () => void {
  void hydrateQueue().then(() => drain());
  const unsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      void drain();
    }
  });
  return unsubscribe;
}

export function inspectQueue(): QueuedRequest[] {
  return [...memoryQueue];
}
