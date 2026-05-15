import * as Linking from 'expo-linking';
import { Alert } from 'react-native';

import { config } from '@/config/env';

/**
 * External-link helpers (tel:, mailto:, wa.me, deep links).
 * Centralised so analytics can plug in once and we surface consistent
 * "Cannot open" toasts when an app/scheme is missing.
 */
function normaliseWhatsAppNumber(number?: string): string {
  const raw = (number ?? config.whatsappNumber).replace(/[^\d]/g, '');
  return raw;
}

async function tryOpen(url: string, fallback?: string): Promise<void> {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported && fallback) {
      await Linking.openURL(fallback);
      return;
    }
    await Linking.openURL(url);
  } catch {
    Alert.alert('Unable to open', fallback ?? url);
  }
}

export async function openWhatsApp(message: string, number?: string): Promise<void> {
  const phone = normaliseWhatsAppNumber(number);
  const encoded = encodeURIComponent(message);
  const native = `whatsapp://send?phone=${phone}&text=${encoded}`;
  const web = `https://wa.me/${phone}?text=${encoded}`;
  await tryOpen(native, web);
}

export async function dialPhone(number?: string): Promise<void> {
  const phone = (number ?? config.supportPhone).replace(/\s+/g, '');
  await tryOpen(`tel:${phone}`);
}

export async function sendEmail(subject: string, body = '', to?: string): Promise<void> {
  const target = to ?? config.supportEmail;
  const url = `mailto:${target}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  await tryOpen(url);
}

export async function openExternal(url: string): Promise<void> {
  await tryOpen(url);
}
