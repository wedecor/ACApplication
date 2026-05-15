/**
 * Lightweight analytics dispatcher.
 *
 * Fans out a single canonical `track(event, props)` call to every
 * configured destination — currently GA4 (gtag), GTM (dataLayer) and
 * Meta Pixel (fbq). The destination scripts are loaded lazily by the
 * `<AnalyticsScripts>` component so this file is safe to import in any
 * client component.
 *
 * Destination calls fail soft — missing globals are silently ignored
 * (the script may still be loading or blocked by an ad blocker).
 */

import { siteConfig } from '@/env';

type Primitive = string | number | boolean | null | undefined;
export type TrackProps = Record<string, Primitive | Primitive[]>;

declare global {
  interface Window {
    // GA4 — set by the <Script> loader.
    gtag?: (...args: unknown[]) => void;
    // GTM
    dataLayer?: unknown[];
    // Meta Pixel
    fbq?: (...args: unknown[]) => void;
  }
}

/**
 * Standard event names — fixed list so reporting stays clean. Add new
 * names here rather than passing free strings around the codebase.
 */
export const Events = {
  PageView: 'page_view',
  CtaClick: 'cta_click',
  WhatsAppClick: 'whatsapp_click',
  CallClick: 'call_click',
  LeadStart: 'lead_start',
  LeadStepCompleted: 'lead_step_completed',
  LeadSubmitted: 'lead_submitted',
  BookingConfirmed: 'booking_confirmed',
  EmergencyClick: 'emergency_click',
  CallbackRequest: 'callback_request',
  NewsletterSignup: 'newsletter_signup',
  ExitIntentShown: 'exit_intent_shown',
  ExitIntentConverted: 'exit_intent_converted',
} as const;
export type EventName = (typeof Events)[keyof typeof Events];

export function track(event: EventName | string, props: TrackProps = {}): void {
  if (typeof window === 'undefined') return;
  const sanitized = sanitize(props);

  try {
    window.gtag?.('event', event, sanitized);
  } catch (err) {
    if (siteConfig.analytics.gaId) console.warn('[analytics] gtag failed', err);
  }
  try {
    (window.dataLayer ??= []).push({ event, ...sanitized });
  } catch (err) {
    if (siteConfig.analytics.gtmId) console.warn('[analytics] dataLayer failed', err);
  }
  try {
    // Meta Pixel — map our canonical names to FB standard events when possible.
    const fbEvent = META_EVENT_MAP[event as EventName] ?? null;
    if (fbEvent) window.fbq?.('track', fbEvent, sanitized);
    else window.fbq?.('trackCustom', event, sanitized);
  } catch (err) {
    if (siteConfig.analytics.metaPixelId) console.warn('[analytics] fbq failed', err);
  }
}

const META_EVENT_MAP: Partial<Record<EventName, string>> = {
  [Events.LeadStart]: 'InitiateCheckout',
  [Events.LeadStepCompleted]: 'AddPaymentInfo',
  [Events.LeadSubmitted]: 'Lead',
  [Events.BookingConfirmed]: 'Purchase',
  [Events.WhatsAppClick]: 'Contact',
  [Events.CallClick]: 'Contact',
};

/**
 * Remove nullish / undefined values and stringify arrays for transport.
 * Most analytics destinations can't handle nested objects.
 */
function sanitize(props: TrackProps): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined) continue;
    if (Array.isArray(v)) {
      out[k] = v.filter((x) => x !== null && x !== undefined).join(',');
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** Capture UTM / click-id params from the URL and persist for attribution. */
export interface Attribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  gclid?: string;
  fbclid?: string;
  msclkid?: string;
}

const STORAGE_KEY = 'ac:attr:v1';

export function captureAttribution(searchParams: URLSearchParams): Attribution {
  if (typeof window === 'undefined') return {};
  const keys: (keyof Attribution)[] = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
    'gclid',
    'fbclid',
    'msclkid',
  ];
  const incoming: Attribution = {};
  for (const k of keys) {
    const v = searchParams.get(k);
    if (v) incoming[k] = v;
  }
  if (Object.keys(incoming).length === 0) {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as Attribution;
    } catch {}
    return {};
  }
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(incoming));
  } catch {}
  return incoming;
}

export function getStoredAttribution(): Attribution {
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Attribution) : {};
  } catch {
    return {};
  }
}
