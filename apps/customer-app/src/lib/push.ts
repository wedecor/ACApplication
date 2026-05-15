import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { api, ApiError } from '@/lib/api-client';
import { getDeviceFingerprint } from '@/lib/device';
import { secureStore, SecureKeys } from '@/lib/secure-store';

/**
 * Push notification plumbing.
 *
 * - Configures the foreground notification handler.
 * - Requests permissions on demand (called from the auth shell after login).
 * - Obtains an Expo push token and reports it to the backend so the
 *   notification module can target this device.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function ensureNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'General',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#0f59db',
  });
  await Notifications.setNotificationChannelAsync('booking', {
    name: 'Service updates',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
  });
  await Notifications.setNotificationChannelAsync('arrival', {
    name: 'Technician arriving',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    bypassDnd: false,
  });
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;
  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const ask = await Notifications.requestPermissionsAsync();
    status = ask.status;
  }
  if (status !== 'granted') return null;
  await ensureNotificationChannels();
  const token = await Notifications.getExpoPushTokenAsync();
  const cached = await secureStore.getItem(SecureKeys.PushToken);
  if (cached === token.data) return token.data;
  await secureStore.setItem(SecureKeys.PushToken, token.data);
  await reportTokenToServer(token.data);
  return token.data;
}

export async function unregisterPushToken(): Promise<void> {
  const cached = await secureStore.getItem(SecureKeys.PushToken);
  if (!cached) return;
  try {
    await api.delete('/v1/notifications/devices', {
      query: { token: cached },
    });
  } catch {
    /* best-effort */
  }
  await secureStore.removeItem(SecureKeys.PushToken);
}

async function reportTokenToServer(token: string): Promise<void> {
  try {
    const fingerprint = await getDeviceFingerprint();
    await api.post('/v1/notifications/devices', {
      token,
      provider: 'expo',
      platform: fingerprint.platform,
      deviceId: fingerprint.deviceId,
      modelName: fingerprint.modelName,
      osVersion: fingerprint.osVersion,
      appVersion: fingerprint.appVersion,
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      // Backend device-registration endpoint not deployed yet \u2014 no-op so
      // we don\u2019t crash the app while the notification module ships.
      return;
    }
    throw err;
  }
}

export function addForegroundNotificationListener(
  handler: (n: Notifications.Notification) => void,
): () => void {
  const sub = Notifications.addNotificationReceivedListener(handler);
  return () => sub.remove();
}

export function addNotificationTapListener(
  handler: (response: Notifications.NotificationResponse) => void,
): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener(handler);
  return () => sub.remove();
}
