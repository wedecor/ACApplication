import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'ac.tech.accessToken';
const REFRESH_KEY = 'ac.tech.refreshToken';
const TECH_ID_KEY = 'ac.tech.technicianId';
const SIGN_KEY = 'ac.tech.locationSignKey';
const DEVICE_KEY = 'ac.tech.deviceId';

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
    SecureStore.setItemAsync(TOKEN_KEY, input.accessToken),
    SecureStore.setItemAsync(REFRESH_KEY, input.refreshToken),
    SecureStore.setItemAsync(TECH_ID_KEY, input.technicianId),
    input.locationSignKey
      ? SecureStore.setItemAsync(SIGN_KEY, input.locationSignKey)
      : SecureStore.deleteItemAsync(SIGN_KEY),
  ]);
}

export async function clearAuthSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
    SecureStore.deleteItemAsync(TECH_ID_KEY),
    SecureStore.deleteItemAsync(SIGN_KEY),
  ]);
}

export async function getAuthToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_KEY);
}

export async function getTechnicianId(): Promise<string | null> {
  return SecureStore.getItemAsync(TECH_ID_KEY);
}

export async function getLocationSignKey(): Promise<string | null> {
  return SecureStore.getItemAsync(SIGN_KEY);
}

/**
 * Stable device identifier — returned by `Device.osBuildId` on Android +
 * generated UUID on iOS (since Apple deprecated identifierForVendor for the
 * privacy of cross-app tracking). Persisted so it survives re-installs.
 */
export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_KEY);
  if (existing) return existing;
  const base = `${Device.osName ?? 'unknown'}-${Device.modelName ?? 'device'}-${Device.osBuildId ?? ''}`;
  const id = `${base}-${Crypto.randomUUID()}`;
  await SecureStore.setItemAsync(DEVICE_KEY, id);
  return id;
}
