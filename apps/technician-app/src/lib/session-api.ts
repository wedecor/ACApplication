import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { api } from './api';
import { clearAuthSession, getOrCreateDeviceId, setAuthSession } from './auth';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface TechnicianSelf {
  id: string;
  employeeCode: string;
  fullName: string;
}

/** Normalise a 10-digit Indian mobile (or an already-E.164 number) to E.164. */
export function toE164(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, '');
  if (/^\+\d{8,15}$/.test(digits)) return digits;
  const local = digits.replace(/^0+/, '');
  if (/^[6-9]\d{9}$/.test(local)) return `+91${local}`;
  return null;
}

export function requestLoginOtp(phone: string) {
  return api<{ ttlSeconds: number; sentTo: string; devCode?: string }>('/auth/otp/request', {
    method: 'POST',
    body: { destination: phone, purpose: 'LOGIN' },
  });
}

/**
 * Verify the code, then bind the session to the caller's technician profile.
 * Nothing is persisted unless the account really is a technician.
 */
export async function signIn(phone: string, code: string): Promise<TechnicianSelf> {
  const deviceId = await getOrCreateDeviceId();
  const tokens = await api<TokenPair>('/auth/otp/verify', {
    method: 'POST',
    body: { destination: phone, code, device: { deviceId, platform: Platform.OS } },
  });
  const self = await api<TechnicianSelf>('/technicians/me', { token: tokens.accessToken });
  await setAuthSession({ ...tokens, technicianId: self.id });
  return self;
}

/** Keys under this prefix hold work data (queues, job-card drafts, snapshots). */
const LOCAL_DATA_PREFIX = 'ac.tech.';

/** Pick the device-local keys to wipe at sign-out. */
export function localWorkKeys(keys: readonly string[]): string[] {
  return keys.filter((k) => k.startsWith(LOCAL_DATA_PREFIX));
}

/**
 * End the session everywhere it lives: revoke it on the server (best effort),
 * forget the tokens, and wipe queued writes, job-card drafts and snapshots —
 * they contain customer data and must not carry over to the next technician.
 */
export async function signOut(): Promise<void> {
  await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
  await clearAuthSession();
  const keys = await AsyncStorage.getAllKeys().catch(() => [] as readonly string[]);
  const wipe = localWorkKeys(keys);
  if (wipe.length) await AsyncStorage.multiRemove(wipe).catch(() => undefined);
}
