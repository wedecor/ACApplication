import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';

/**
 * Lightweight cache persistence so a customer who opens the app in
 * Airplane mode still sees their last bookings/invoices/AMC dashboard.
 *
 * Why not `@tanstack/query-async-storage-persister`? We avoid the
 * extra runtime dependency: a few well-known query keys are persisted
 * by hand on every successful fetch, and rehydrated on app start.
 * Keeps the cold-start bundle slimmer and the rehydration surface
 * tightly scoped.
 */
const STORAGE_KEY = 'ac.customer.cache.v1';

const PERSISTED_KEYS = [
  ['bookings', 'all'],
  ['bookings', 'active'],
  ['invoices'],
  ['amc', 'mine'],
  ['addresses'],
  ['notifications'],
];

function isPersistable(key: readonly unknown[]): boolean {
  return PERSISTED_KEYS.some((tracked) =>
    tracked.every((seg, i) => key[i] === seg),
  );
}

export async function hydrateQueryClient(qc: QueryClient): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { entries: Array<{ key: unknown[]; data: unknown }> };
    for (const entry of parsed.entries ?? []) {
      qc.setQueryData(entry.key, entry.data);
    }
  } catch {
    /* corrupt cache \u2014 skip */
  }
}

export function attachQueryPersistence(qc: QueryClient): () => void {
  let saveQueued = false;
  const unsubscribe = qc.getQueryCache().subscribe(() => {
    if (saveQueued) return;
    saveQueued = true;
    setTimeout(() => {
      saveQueued = false;
      const entries: Array<{ key: unknown[]; data: unknown }> = [];
      for (const q of qc.getQueryCache().getAll()) {
        if (q.state.status !== 'success') continue;
        if (!isPersistable(q.queryKey as readonly unknown[])) continue;
        entries.push({ key: q.queryKey as unknown[], data: q.state.data });
      }
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ entries })).catch(() => undefined);
    }, 750);
  });
  return unsubscribe;
}

export async function clearPersistedQueries(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
