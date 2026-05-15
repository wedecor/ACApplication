/**
 * Google Ads landing-page registry.
 *
 * Each entry is a single-purpose, conversion-optimised page at
 * `/lp/[slug]`. They share a template but each one ships its own copy,
 * keyword and city focus so we can match the keyword the user clicked.
 *
 * Each LP supports a `?kw=` query param for dynamic keyword insertion —
 * the template falls back to `dynamicHeadlineFallback` when absent.
 *
 * IMPORTANT: LPs are **noindex**. They exist only for paid traffic, and
 * the same content lives on the canonical `/[city]/[service]` page for
 * organic ranking. This avoids cannibalising the SEO funnel.
 */

import type { ServiceCategory } from '@ac/types';

export interface LandingPage {
  slug: string;
  /** ServiceCategory the LP collects leads for. */
  serviceCategory: ServiceCategory;
  /** City slug for attribution & local copy. */
  citySlug: string | null;
  /** H1 — supports {{keyword}} token. */
  heading: string;
  /** Fallback for {{keyword}} when no `?kw=` is present. */
  dynamicHeadlineFallback: string;
  /** Subheading shown under the H1. */
  subheading: string;
  /** Hero CTA copy. */
  primaryCta: string;
  /** Trust badges shown above the form. */
  trustBadges: Array<{ label: string; sublabel?: string }>;
  /** Three or four step "how it works" copy. */
  steps: Array<{ title: string; description: string }>;
  /** Before / after content with image references. */
  beforeAfter?: {
    title: string;
    before: { image: string; caption: string };
    after: { image: string; caption: string };
  };
  /** Urgency banner — kept simple to avoid manipulative copy. */
  urgency: string | null;
  /** GA / Meta conversion event names. */
  conversionEvents: { lead: string; whatsapp: string };
  /** Brief pricing strip — usually 2-3 bands. */
  pricingHighlights: Array<{ label: string; price: string; note?: string }>;
  /** SEO metadata. */
  seo: {
    title: string;
    description: string;
  };
}

export const LANDING_PAGES: LandingPage[] = [
  {
    slug: 'ac-repair-bangalore',
    serviceCategory: 'AC_REPAIR',
    citySlug: 'bengaluru',
    heading: '{{keyword}} — 60-Minute Response, ₹299 Visit Fee',
    dynamicHeadlineFallback: 'AC Repair in Bangalore',
    subheading:
      'Trained technicians, genuine parts, transparent quote on WhatsApp before any work starts. 30-day service warranty.',
    primaryCta: 'Book a Free Diagnosis',
    trustBadges: [
      { label: '48,200+ AC repairs', sublabel: 'in Bengaluru' },
      { label: '4.8 / 5', sublabel: 'across 12,450 reviews' },
      { label: '30-day warranty', sublabel: 'on labour & parts' },
    ],
    steps: [
      { title: 'Tell us the issue', description: 'Pick your AC brand, issue, address — takes 60 seconds.' },
      { title: 'Technician en route', description: 'Verified expert arrives in your 2-hour window.' },
      { title: 'Approve the quote', description: 'See a transparent quote on WhatsApp before work starts.' },
      { title: 'Pay after repair', description: 'UPI / card / cash on completion + 30-day warranty.' },
    ],
    beforeAfter: {
      title: 'Real customer outcomes',
      before: {
        image: '/images/lp/ac-before.webp',
        caption: 'Indoor unit clogged with dust and bio-film.',
      },
      after: {
        image: '/images/lp/ac-after.webp',
        caption: 'Post chemical-wash — 32 % cooling improvement.',
      },
    },
    urgency: 'Slots filling fast — same-day visits available till 8 PM.',
    conversionEvents: { lead: 'lp_ac_blr_lead', whatsapp: 'lp_ac_blr_whatsapp' },
    pricingHighlights: [
      { label: 'Diagnosis visit', price: '₹299', note: 'Adjusted into repair' },
      { label: 'Standard repair', price: 'From ₹699' },
      { label: 'Gas refill (split)', price: 'From ₹2,899' },
    ],
    seo: {
      title: 'AC Repair in Bangalore — Same-Day, ₹299 Visit | AC Platform',
      description:
        'Book AC repair in Bangalore — same-day service, transparent ₹299 diagnosis, 30-day warranty. 48,000+ ACs serviced. WhatsApp booking.',
    },
  },
  {
    slug: 'refrigerator-service',
    serviceCategory: 'REFRIGERATOR',
    citySlug: null,
    heading: '{{keyword}} at Home — Same-Day Visit',
    dynamicHeadlineFallback: 'Refrigerator Repair at Home',
    subheading:
      'Fridge not cooling? Gas leak? Excess frost? Certified technicians fix every brand, same day.',
    primaryCta: 'Get an Instant Quote on WhatsApp',
    trustBadges: [
      { label: '23,000+ fridges serviced' },
      { label: '4.7 / 5', sublabel: 'across cities' },
      { label: 'Genuine parts', sublabel: 'Brand-OEM' },
    ],
    steps: [
      { title: 'Pick your fridge type', description: 'Single-door, double-door or side-by-side.' },
      { title: 'Describe the issue', description: 'Not cooling, frost build-up, leakage…' },
      { title: 'Verified technician arrives', description: 'Same-day in serviceable cities.' },
      { title: 'Approve the quote', description: 'Always on WhatsApp — work starts only after.' },
    ],
    urgency: null,
    conversionEvents: { lead: 'lp_fridge_lead', whatsapp: 'lp_fridge_whatsapp' },
    pricingHighlights: [
      { label: 'Diagnosis visit', price: '₹299', note: 'Adjusted into repair' },
      { label: 'Standard repair', price: 'From ₹699' },
      { label: 'Gas refill (DD)', price: 'From ₹2,499' },
    ],
    seo: {
      title: 'Refrigerator Repair at Home — Same-Day Service | AC Platform',
      description:
        'Same-day refrigerator repair at home. Fridge not cooling, gas refill, frost issues — certified technicians, transparent ₹299 visit fee, 30-day warranty.',
    },
  },
  {
    slug: 'emergency-ac-repair',
    serviceCategory: 'AC_REPAIR',
    citySlug: null,
    heading: '{{keyword}} — Technician at Your Door in 60 Minutes',
    dynamicHeadlineFallback: 'Emergency AC Repair',
    subheading:
      'AC died in this heat? Tap below — a verified technician is dispatched within minutes.',
    primaryCta: 'Send a Technician Now',
    trustBadges: [
      { label: '60-min response', sublabel: 'in serviceable cities' },
      { label: '24×7 dispatch', sublabel: 'including Sundays' },
      { label: '30-day warranty', sublabel: 'no fine print' },
    ],
    steps: [
      { title: 'Tap “Send a Technician”', description: 'A dispatcher rings you in under 5 minutes.' },
      { title: 'Confirm address & brand', description: 'We dispatch the nearest verified expert.' },
      { title: 'On-spot fix', description: '85 % of issues resolved in the same visit.' },
    ],
    urgency: 'Live dispatch — heat-wave priority.',
    conversionEvents: { lead: 'lp_emergency_lead', whatsapp: 'lp_emergency_whatsapp' },
    pricingHighlights: [
      { label: 'Emergency visit', price: '₹499', note: 'Adjusted into repair' },
      { label: 'Standard repair', price: 'From ₹699' },
      { label: 'Gas refill', price: 'From ₹2,899' },
    ],
    seo: {
      title: 'Emergency AC Repair — 60-Minute Response | AC Platform',
      description:
        'Emergency AC repair, 60-minute response. Same-day technicians dispatched 24×7 across major cities. WhatsApp / phone booking.',
    },
  },
];

const LP_BY_SLUG = new Map(LANDING_PAGES.map((lp) => [lp.slug, lp] as const));

export function getLandingBySlug(slug: string): LandingPage | null {
  return LP_BY_SLUG.get(slug) ?? null;
}

export function getAllLandingSlugs(): string[] {
  return LANDING_PAGES.map((lp) => lp.slug);
}
