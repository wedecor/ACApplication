import * as SecureStore from 'expo-secure-store';

/**
 * Secure key/value store with namespaced keys.
 *
 * Uses Keychain on iOS and EncryptedSharedPreferences on Android via
 * `expo-secure-store`. Falls back to no-op behaviour on web (the customer
 * app is mobile-first; running on web is dev-only).
 */
const PREFIX = 'ac.customer.';

const isWeb = typeof window !== 'undefined' && typeof document !== 'undefined';

export const secureStore = {
  async setItem(key: string, value: string): Promise<void> {
    if (isWeb) {
      try {
        window.localStorage.setItem(PREFIX + key, value);
      } catch {
        /* ignore */
      }
      return;
    }
    await SecureStore.setItemAsync(PREFIX + key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },
  async getItem(key: string): Promise<string | null> {
    if (isWeb) {
      try {
        return window.localStorage.getItem(PREFIX + key);
      } catch {
        return null;
      }
    }
    return SecureStore.getItemAsync(PREFIX + key);
  },
  async removeItem(key: string): Promise<void> {
    if (isWeb) {
      try {
        window.localStorage.removeItem(PREFIX + key);
      } catch {
        /* ignore */
      }
      return;
    }
    await SecureStore.deleteItemAsync(PREFIX + key);
  },
};

export const SecureKeys = {
  AccessToken: 'auth.access',
  RefreshToken: 'auth.refresh',
  UserId: 'auth.userId',
  TenantId: 'auth.tenantId',
  Profile: 'auth.profile',
  BiometricEnabled: 'auth.biometric',
  PushToken: 'push.token',
  DeviceId: 'device.id',
} as const;

export type SecureKey = (typeof SecureKeys)[keyof typeof SecureKeys];
