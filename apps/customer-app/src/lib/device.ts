import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { secureStore, SecureKeys } from '@/lib/secure-store';

/**
 * Device fingerprinting: stable, per-install identifier plus best-effort
 * model/OS metadata that we report alongside the refresh token so the
 * server-side `Devices` table can track active sessions and power the
 * "logout all other devices" flow.
 */
export interface DeviceFingerprint {
  deviceId: string;
  platform: 'ios' | 'android' | 'web' | 'unknown';
  modelName: string | null;
  osVersion: string | null;
  appVersion: string | null;
  bundleId: string | null;
  isPhysical: boolean;
}

let cached: DeviceFingerprint | null = null;

function randomId(): string {
  const a = Date.now().toString(36);
  const b = Math.random().toString(36).slice(2, 10);
  return `${a}-${b}`;
}

export async function getDeviceFingerprint(): Promise<DeviceFingerprint> {
  if (cached) return cached;
  let deviceId = await secureStore.getItem(SecureKeys.DeviceId);
  if (!deviceId) {
    deviceId = randomId();
    await secureStore.setItem(SecureKeys.DeviceId, deviceId);
  }
  const platform: DeviceFingerprint['platform'] =
    Platform.OS === 'ios' || Platform.OS === 'android' || Platform.OS === 'web'
      ? Platform.OS
      : 'unknown';
  cached = {
    deviceId,
    platform,
    modelName: Device.modelName ?? null,
    osVersion: Device.osVersion ?? null,
    appVersion: Application.nativeApplicationVersion ?? null,
    bundleId: Application.applicationId ?? null,
    isPhysical: Device.isDevice,
  };
  return cached;
}
