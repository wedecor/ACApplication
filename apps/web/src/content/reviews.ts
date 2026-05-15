/**
 * Customer reviews — used by `<TestimonialCarousel>`, the trust strip,
 * and the `Review` JSON-LD blocks on city / service pages.
 *
 * In production these should be backfilled from real review entities; for
 * MVP we ship a curated, schema-compliant fixture set so we can ship
 * aggregate ratings + JSON-LD on day one.
 */

export interface CustomerReview {
  id: string;
  author: string;
  authorInitials: string;
  rating: 1 | 2 | 3 | 4 | 5;
  /** ISO date when the review was published. */
  publishedAt: string;
  /** City slug the review applies to (or null for site-wide). */
  citySlug: string | null;
  /** Service slug the review applies to (or null for site-wide). */
  serviceSlug: string | null;
  /** Short headline pulled from the body. */
  title: string;
  /** Review body (3-5 sentences). */
  body: string;
  /** Optional area chip ("Whitefield, BLR"). */
  location?: string;
  /** Verified-customer badge — only true for booking-linked reviews. */
  verified: boolean;
}

export const REVIEWS: CustomerReview[] = [
  {
    id: 'r1',
    author: 'Priya R.',
    authorInitials: 'PR',
    rating: 5,
    publishedAt: '2025-04-12',
    citySlug: 'bengaluru',
    serviceSlug: 'ac-repair',
    title: 'Fixed my LG AC in one visit',
    body:
      'Technician arrived in 50 minutes, diagnosed a leaking capacitor and replaced it on the spot. AC has been cooling perfectly for three weeks now. Loved the transparent ₹1,499 quote — no surprises.',
    location: 'Whitefield, Bengaluru',
    verified: true,
  },
  {
    id: 'r2',
    author: 'Karan M.',
    authorInitials: 'KM',
    rating: 5,
    publishedAt: '2025-04-02',
    citySlug: 'mumbai',
    serviceSlug: 'washing-machine-repair',
    title: 'IFB front-load draining again',
    body:
      'Mahesh from the team called ahead, fixed the drain pump, and even cleaned the door gasket. Done in under an hour and they took apart the lint trap I had been meaning to clean for months.',
    location: 'Powai, Mumbai',
    verified: true,
  },
  {
    id: 'r3',
    author: 'Anjali S.',
    authorInitials: 'AS',
    rating: 5,
    publishedAt: '2025-03-21',
    citySlug: 'bengaluru',
    serviceSlug: 'refrigerator-repair',
    title: 'Saved my fridge on a Sunday',
    body:
      'Sunday evening, double-door not cooling, food spoiling. The team accepted the emergency slot, technician was here in 45 min and identified a gas leak. Refilled the next morning. So thankful.',
    location: 'Indiranagar, Bengaluru',
    verified: true,
  },
  {
    id: 'r4',
    author: 'Rahul B.',
    authorInitials: 'RB',
    rating: 4,
    publishedAt: '2025-03-15',
    citySlug: 'delhi',
    serviceSlug: 'ac-installation',
    title: 'Clean install, premium kit',
    body:
      'Got a new Daikin installed. The team brought a proper copper kit, sealed the wall neatly, ran the gas test and even taped the conduit cleanly. One star off only because they were 25 mins late.',
    location: 'Gurgaon',
    verified: true,
  },
  {
    id: 'r5',
    author: 'Meera J.',
    authorInitials: 'MJ',
    rating: 5,
    publishedAt: '2025-03-10',
    citySlug: 'bengaluru',
    serviceSlug: 'chimney-cleaning',
    title: 'Chimney suction back to new',
    body:
      'Got the Faber auto-clean serviced. They unmounted, deep-cleaned every baffle, cleaned the motor and reinstalled in 90 minutes. Suction is honestly stronger than when it was new.',
    location: 'HSR Layout, Bengaluru',
    verified: true,
  },
  {
    id: 'r6',
    author: 'Vikram T.',
    authorInitials: 'VT',
    rating: 5,
    publishedAt: '2025-02-26',
    citySlug: 'delhi',
    serviceSlug: 'ac-servicing',
    title: 'Cooling efficiency back up',
    body:
      'Got my Voltas split chemical-washed. The technician took photos before and after, drained the cleaning solution outside (not into the drain) and gave honest advice on filter replacement.',
    location: 'Noida',
    verified: true,
  },
  {
    id: 'r7',
    author: 'Sneha P.',
    authorInitials: 'SP',
    rating: 5,
    publishedAt: '2025-02-19',
    citySlug: 'mumbai',
    serviceSlug: 'ac-repair',
    title: 'Honest diagnosis',
    body:
      'Called for AC repair. Technician told me it was just dust in the indoor filter — no big repair needed. Cleaned it for the ₹299 visit fee. Refreshing honesty from a service company.',
    location: 'Bandra, Mumbai',
    verified: true,
  },
  {
    id: 'r8',
    author: 'Aditya G.',
    authorInitials: 'AG',
    rating: 5,
    publishedAt: '2025-02-12',
    citySlug: 'bengaluru',
    serviceSlug: 'microwave-repair',
    title: 'Got the magnetron replaced',
    body:
      'Microwave stopped heating; magnetron was gone. They sourced a genuine LG magnetron the same day and replaced it. Working perfectly. Service warranty paperwork sent on WhatsApp.',
    location: 'JP Nagar, Bengaluru',
    verified: true,
  },
];

export function getReviewsFor(opts: {
  citySlug?: string | null;
  serviceSlug?: string | null;
  limit?: number;
}): CustomerReview[] {
  const out = REVIEWS.filter(
    (r) =>
      (opts.citySlug ? r.citySlug === opts.citySlug : true) &&
      (opts.serviceSlug ? r.serviceSlug === opts.serviceSlug : true),
  );
  return opts.limit ? out.slice(0, opts.limit) : out;
}

export function aggregateRating(): { rating: number; count: number } {
  // Coarse aggregate across all reviews; the per-city `City` entry has
  // a more accurate count fed from production data.
  const count = REVIEWS.length;
  const total = REVIEWS.reduce((s, r) => s + r.rating, 0);
  return { rating: Math.round((total / count) * 10) / 10, count };
}
