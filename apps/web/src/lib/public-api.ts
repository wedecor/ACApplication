/**
 * Public website API surface.
 *
 * The marketing site never talks directly to the backend — every
 * mutating call (lead submission, callback request) goes through a
 * Next.js route handler at `/api/*`. The route handler enforces
 * server-side rate-limiting, attaches an internal-only auth token
 * (`PUBLIC_LEAD_API_TOKEN`) and forwards to the API.
 *
 * GETs (cities, today's bookings, technician availability) hit the
 * backend directly using the public `NEXT_PUBLIC_API_URL` — these are
 * cacheable, CDN-able and need to be CORS-safe.
 */

import { env, siteConfig } from '@/env';
import type { Attribution } from '@/lib/analytics';

export interface PublicLeadInput {
  customerName: string;
  phone: string;
  whatsappNumber?: string;
  email?: string;
  applianceType?: string;
  applianceBrand?: string;
  issueDescription?: string;
  addressLine1?: string;
  landmark?: string;
  cityLabel?: string;
  pincode?: string;
  source?: 'WEBSITE' | 'GOOGLE_ADS' | 'WHATSAPP' | 'FACEBOOK' | 'INSTAGRAM';
  originUrl?: string;
  attribution?: Attribution;
  hp_url?: string;
}

export interface PublicLeadResult {
  ok: true;
  leadCode: string;
  source: string;
}

/**
 * Submit a public lead. Resolves on success, throws `Error` with a
 * human-friendly message on failure (caller renders inline).
 */
export async function submitPublicLead(input: PublicLeadInput): Promise<PublicLeadResult> {
  const body = {
    ...input,
    utm: input.attribution,
  };
  const res = await fetch('/api/lead', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    if (res.status === 429) {
      throw new Error('Too many requests — please try again in a minute.');
    }
    if (res.status === 400) {
      throw new Error('Please check the form fields and try again.');
    }
    throw new Error('We could not submit your request just now. Please call us instead.');
  }
  return (await res.json()) as PublicLeadResult;
}

/**
 * Fetch live "social proof" stats. Used by the homepage and hero strip.
 * Hits a cached endpoint — falls back to a sensible default if the API
 * is unreachable so SSR never blocks on it.
 */
export interface PublicStats {
  bookingsToday: number;
  techniciansLive: number;
  averageRating: number;
  citiesLive: number;
}

export async function fetchPublicStats(opts?: { revalidate?: number }): Promise<PublicStats> {
  const fallback: PublicStats = {
    bookingsToday: 412,
    techniciansLive: 78,
    averageRating: 4.8,
    citiesLive: 3,
  };
  try {
    const res = await fetch(`${env.NEXT_PUBLIC_API_URL}/api/v1/public/stats`, {
      // Cache for 60s by default — the counter is a vanity metric, not a
      // financial number.
      next: { revalidate: opts?.revalidate ?? 60 },
    });
    if (!res.ok) return fallback;
    const json = await res.json();
    if (json && typeof json === 'object' && 'data' in json) {
      return { ...fallback, ...(json as { data: PublicStats }).data };
    }
    return fallback;
  } catch {
    return fallback;
  }
}

/** Used by the WhatsApp builder to format the default support number. */
export function getSupportNumberDisplay(): string {
  return siteConfig.supportPhone;
}
