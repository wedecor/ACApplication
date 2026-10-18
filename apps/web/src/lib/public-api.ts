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
 * Live "social proof" figures from the API — the only source for ratings,
 * review counts and repair/customer totals shown on the site. Every field is
 * null when unknown (API down, or no data yet) so pages hide the figure
 * instead of showing an invented one.
 */
export interface PublicStats {
  bookingsToday: number | null;
  techniciansLive: number | null;
  citiesLive: number | null;
  completedRepairs: number | null;
  customersServed: number | null;
  /** Mean of real booking ratings; null until there is at least one. */
  averageRating: number | null;
  ratingCount: number | null;
}

export const EMPTY_STATS: PublicStats = {
  bookingsToday: null,
  techniciansLive: null,
  citiesLive: null,
  completedRepairs: null,
  customersServed: null,
  averageRating: null,
  ratingCount: null,
};

/** Keep only finite, non-negative numbers from the API payload. */
export function parsePublicStats(data: unknown): PublicStats {
  if (!data || typeof data !== 'object') return EMPTY_STATS;
  const d = data as Record<string, unknown>;
  const num = (k: keyof PublicStats) => {
    const v = d[k];
    return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
  };
  const ratingCount = num('ratingCount');
  return {
    bookingsToday: num('bookingsToday'),
    techniciansLive: num('techniciansLive'),
    citiesLive: num('citiesLive'),
    completedRepairs: num('completedRepairs'),
    customersServed: num('customersServed'),
    averageRating: ratingCount ? num('averageRating') : null,
    ratingCount,
  };
}

export async function fetchPublicStats(opts?: { revalidate?: number }): Promise<PublicStats> {
  try {
    const res = await fetch(`${env.NEXT_PUBLIC_API_URL}/api/v1/public/stats`, {
      // Cache for 60s by default — marketing counters, not financial numbers.
      next: { revalidate: opts?.revalidate ?? 60 },
    });
    if (!res.ok) return EMPTY_STATS;
    const json = (await res.json()) as { data?: unknown } | null;
    return parsePublicStats(json?.data);
  } catch {
    return EMPTY_STATS;
  }
}

/** schema.org AggregateRating from real ratings only; null hides it from JSON-LD. */
export function aggregateRatingLd(stats: PublicStats): { rating: number; count: number } | null {
  return stats.averageRating != null && stats.ratingCount ? { rating: stats.averageRating, count: stats.ratingCount } : null;
}

/** "4.4 / 5 · 37 reviews", or null when there are no real ratings yet. */
export function ratingSummary(stats: PublicStats): string | null {
  const agg = aggregateRatingLd(stats);
  if (!agg) return null;
  return `${agg.rating.toFixed(1)} / 5 · ${agg.count.toLocaleString('en-IN')} review${agg.count === 1 ? '' : 's'}`;
}

/** Used by the WhatsApp builder to format the default support number. */
export function getSupportNumberDisplay(): string {
  return siteConfig.supportPhone;
}
