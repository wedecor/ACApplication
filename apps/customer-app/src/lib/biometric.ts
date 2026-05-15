import * as LocalAuthentication from 'expo-local-authentication';

import { secureStore, SecureKeys } from '@/lib/secure-store';

/**
 * Thin wrapper around expo-local-authentication. Two responsibilities:
 *
 *  1. `isBiometricAvailable()` — gate the toggle in Settings.
 *  2. `requireBiometric()` — challenge the user before sensitive actions
 *     (app unlock, large payments, logging out other devices, etc.).
 *
 * The opt-in flag itself lives in {@link secureStore} so it travels with
 * the session and disappears on logout.
 */
export async function isBiometricAvailable(): Promise<boolean> {
  const hw = await LocalAuthentication.hasHardwareAsync();
  if (!hw) return false;
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return enrolled;
}

export async function requireBiometric(reason = 'Confirm it\u2019s you'): Promise<boolean> {
  const available = await isBiometricAvailable();
  if (!available) return true;
  const res = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
  });
  return res.success;
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  if (enabled) {
    await secureStore.setItem(SecureKeys.BiometricEnabled, '1');
  } else {
    await secureStore.removeItem(SecureKeys.BiometricEnabled);
  }
}

export async function getBiometricEnabled(): Promise<boolean> {
  return (await secureStore.getItem(SecureKeys.BiometricEnabled)) === '1';
}
