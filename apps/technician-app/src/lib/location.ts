import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Battery from 'expo-battery';
import * as Crypto from 'expo-crypto';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { api } from './api';
import { getLocationSignKey, getOrCreateDeviceId, getTechnicianId } from './auth';

export const FOREGROUND_TASK = 'ac-location-foreground';
export const BACKGROUND_TASK = 'ac-location-background';

const QUEUE_KEY = 'ac.tech.locationQueue';
const MAX_QUEUE_SIZE = 500;
const FOREGROUND_INTERVAL_MS = 15_000;
const BACKGROUND_INTERVAL_MS = 60_000;
const DISTANCE_M = 25;
const FLUSH_BATCH = 50;

export interface QueuedPing {
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  heading: number | null;
  speedMps: number | null;
  altitudeM: number | null;
  batteryPct: number | null;
  isBackground: boolean;
  wasOffline: boolean;
  signature: string | null;
  deviceId: string;
  source: 'expo-foreground' | 'expo-background' | 'simulator';
  recordedAt: string;
}

/**
 * Battery + power profile:
 *   - Foreground:  high accuracy, 15s / 25m updates, signed.
 *   - Background:  balanced accuracy, 60s / 100m updates, signed.
 *   - Sleep mode:  the OS pauses updates; offline queue covers gaps.
 *
 * All pings flow through a single AsyncStorage-backed queue. We flush on
 * every emit + on a 30s timer. Failed flushes are retried later — the API
 * uses HMAC + timestamp drift checks to defeat replay.
 */
export async function ensurePermissions(): Promise<{ foreground: boolean; background: boolean }> {
  const fg = await Location.requestForegroundPermissionsAsync();
  let bg = { status: 'denied' } as Awaited<ReturnType<typeof Location.requestBackgroundPermissionsAsync>>;
  if (fg.status === 'granted') {
    bg = await Location.requestBackgroundPermissionsAsync();
  }
  return { foreground: fg.status === 'granted', background: bg.status === 'granted' };
}

export async function startForegroundTracking(): Promise<void> {
  const perms = await ensurePermissions();
  if (!perms.foreground) throw new Error('Foreground location permission denied');
  await Location.startLocationUpdatesAsync(FOREGROUND_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: FOREGROUND_INTERVAL_MS,
    distanceInterval: DISTANCE_M,
    showsBackgroundLocationIndicator: false,
    foregroundService: undefined,
    deferredUpdatesInterval: 0,
  });
}

export async function startBackgroundTracking(): Promise<void> {
  const perms = await ensurePermissions();
  if (!perms.background) throw new Error('Background location permission denied');
  await Location.startLocationUpdatesAsync(BACKGROUND_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: BACKGROUND_INTERVAL_MS,
    distanceInterval: 100,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'AC Platform',
      notificationBody: 'Sharing live location so dispatch can route your jobs.',
      notificationColor: '#0E7A4A',
    },
    pausesUpdatesAutomatically: false,
  });
}

export async function stopAllTracking(): Promise<void> {
  await Promise.all([
    Location.hasStartedLocationUpdatesAsync(FOREGROUND_TASK).then((v) =>
      v ? Location.stopLocationUpdatesAsync(FOREGROUND_TASK) : null,
    ),
    Location.hasStartedLocationUpdatesAsync(BACKGROUND_TASK).then((v) =>
      v ? Location.stopLocationUpdatesAsync(BACKGROUND_TASK) : null,
    ),
  ]);
}

/**
 * Persisted queue helpers — atomic-ish updates via a serialised read /
 * mutate / write. We accept the rare lost-write under concurrent writes
 * (the next ping cycle will re-write the queue anyway).
 */
async function readQueue(): Promise<QueuedPing[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as QueuedPing[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: QueuedPing[]): Promise<void> {
  const trimmed = items.length > MAX_QUEUE_SIZE ? items.slice(items.length - MAX_QUEUE_SIZE) : items;
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(trimmed));
}

export async function enqueuePing(input: Omit<QueuedPing, 'deviceId' | 'signature'>): Promise<void> {
  const deviceId = await getOrCreateDeviceId();
  const signKey = await getLocationSignKey();
  const signature = signKey
    ? await sign(`${deviceId}|${await getTechnicianId()}|${input.latitude.toFixed(6)}|${input.longitude.toFixed(6)}|${input.recordedAt}`, signKey)
    : null;
  const ping: QueuedPing = { ...input, deviceId, signature };
  const queue = await readQueue();
  queue.push(ping);
  await writeQueue(queue);
}

export async function flushQueue(): Promise<{ flushed: number; remaining: number }> {
  const technicianId = await getTechnicianId();
  if (!technicianId) return { flushed: 0, remaining: 0 };

  const queue = await readQueue();
  if (queue.length === 0) return { flushed: 0, remaining: 0 };

  // Slice in batches so we never POST a 5MB payload after a long offline run.
  let flushed = 0;
  let remaining = queue.slice();
  while (remaining.length > 0) {
    const batch = remaining.slice(0, FLUSH_BATCH);
    try {
      await api(`/technicians/${technicianId}/location`, {
        method: 'POST',
        body: { pings: batch },
      });
      flushed += batch.length;
      remaining = remaining.slice(batch.length);
      await writeQueue(remaining);
    } catch (err) {
      // Leave the rest in place — we'll retry on the next tick.
      await writeQueue(remaining);
      return { flushed, remaining: remaining.length };
    }
  }
  return { flushed, remaining: 0 };
}

/**
 * Turn a raw expo-location update into a queued ping. Used by both the
 * foreground + background TaskManager handlers.
 */
export async function handleLocations(
  locations: Location.LocationObject[],
  isBackground: boolean,
  wasOffline: boolean,
): Promise<void> {
  const batteryRaw = await Battery.getBatteryLevelAsync().catch(() => -1);
  const batteryPct = batteryRaw < 0 ? null : Math.round(batteryRaw * 100);
  for (const loc of locations) {
    await enqueuePing({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      accuracyM: loc.coords.accuracy ?? null,
      heading: loc.coords.heading ?? null,
      speedMps: loc.coords.speed ?? null,
      altitudeM: loc.coords.altitude ?? null,
      batteryPct,
      isBackground,
      wasOffline,
      source: isBackground ? 'expo-background' : 'expo-foreground',
      recordedAt: new Date(loc.timestamp).toISOString(),
    });
  }
  await flushQueue().catch(() => undefined);
}

async function sign(payload: string, secret: string): Promise<string> {
  // Expo doesn't ship a native HMAC, so we use the WebCrypto-like helper
  // from expo-crypto. SHA-256 + a `keyed-hash` shape (concat-then-hash) is a
  // simplification — the production app should ship a JSI HMAC. The server
  // accepts both modes (signature presence is enforced when locationSignKey
  // is set; format consistency is checked server-side).
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${secret}|${payload}`,
  );
  return digest;
}

/**
 * Register the TaskManager handlers — called once at app boot. Each handler
 * persists the pings + best-effort flushes. We never throw from inside the
 * handler so the OS doesn't kill the task.
 */
export function registerLocationTasks(): void {
  if (!TaskManager.isTaskDefined(FOREGROUND_TASK)) {
    TaskManager.defineTask(FOREGROUND_TASK, async ({ data, error }) => {
      if (error) return;
      const locations = (data as { locations?: Location.LocationObject[] })?.locations ?? [];
      await handleLocations(locations, false, false).catch(() => undefined);
    });
  }
  if (!TaskManager.isTaskDefined(BACKGROUND_TASK)) {
    TaskManager.defineTask(BACKGROUND_TASK, async ({ data, error }) => {
      if (error) return;
      const locations = (data as { locations?: Location.LocationObject[] })?.locations ?? [];
      await handleLocations(locations, true, false).catch(() => undefined);
    });
  }
}
