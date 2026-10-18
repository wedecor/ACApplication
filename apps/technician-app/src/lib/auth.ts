import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'ac.tech.accessToken';
const REFRESH_KEY = 'ac.tech.refreshToken';
const TECH_ID_KEY = 'ac.tech.technicianId';
const SIGN_KEY = 'ac.tech.locationSignKey';
const DEVICE_KEY = 'ac.tech.deviceId';

const isWeb = typeof window !== 'undefined' && typeof document !== 'undefined';

/**
 * expo-secure-store has no web backend; browser previews (dev-only) fall back
 * to localStorage so the app can be exercised in Chrome.
 */
const store = {
  async get(key: string): Promise<string | null> {
    if (!isWeb) return SecureStore.getItemAsync(key);
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    if (!isWeb) return SecureStore.setItemAsync(key, value);
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* storage unavailable — session lasts until reload */
    }
  },
  async remove(key: string): Promise<void> {
    if (!isWeb) return SecureStore.deleteItemAsync(key);
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

/**
 * Token + device-credential storage. Uses expo-secure-store (Keychain on iOS,
 * EncryptedSharedPreferences on Android). Mirrors the same lifecycle the
 * admin CRM uses but persists across cold starts so the tech doesn't have to
 * re-login every shift.
 */
export async function setAuthSession(input: {
  accessToken: string;
  refreshToken: string;
  technicianId: string;
  locationSignKey?: string | null;
}): Promise<void> {
  await Promise.all([
    store.set(TOKEN_KEY, input.accessToken),
    store.set(REFRESH_KEY, input.refreshToken),
    store.set(TECH_ID_KEY, input.technicianId),
    input.locationSignKey
      ? store.set(SIGN_KEY, input.locationSignKey)
      : store.remove(SIGN_KEY),
  ]);
}

export async function clearAuthSession(): Promise<void> {
  await Promise.all([
    store.remove(TOKEN_KEY),
    store.remove(REFRESH_KEY),
    store.remove(TECH_ID_KEY),
    store.remove(SIGN_KEY),
  ]);
}

export async function getAuthToken(): Promise<string | null> {
  return store.get(TOKEN_KEY);
}

/** Swap in a refreshed token pair without touching the technician binding. */
export async function updateTokens(accessToken: string, refreshToken: string): Promise<void> {
  await Promise.all([store.set(TOKEN_KEY, accessToken), store.set(REFRESH_KEY, refreshToken)]);
}

export async function getRefreshToken(): Promise<string | null> {
  return store.get(REFRESH_KEY);
}

export async function getTechnicianId(): Promise<string | null> {
  return store.get(TECH_ID_KEY);
}

export async function getLocationSignKey(): Promise<string | null> {
  return store.get(SIGN_KEY);
}

/**
 * Stable device identifier — returned by `Device.osBuildId` on Android +
 * generated UUID on iOS (since Apple deprecated identifierForVendor for the
 * privacy of cross-app tracking). Persisted so it survives re-installs.
 */
export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await store.get(DEVICE_KEY);
  if (existing) return existing;
  const base = `${Device.osName ?? 'unknown'}-${Device.modelName ?? 'device'}-${Device.osBuildId ?? ''}`;
  const id = `${base}-${Crypto.randomUUID()}`;
  await store.set(DEVICE_KEY, id);
  return id;
}
