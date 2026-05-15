/**
 * Featured technicians — surfaces on the homepage "people behind the work"
 * strip and on city pages. These are the public profiles only — full
 * technician identity / payouts live in the CRM.
 *
 * In production this should be backed by a `/public/technicians/featured`
 * API endpoint; for now we ship a curated fixture set so the page renders
 * even when the backend is down.
 */

export interface FeaturedTechnician {
  id: string;
  name: string;
  /** Years of professional experience. */
  experienceYears: number;
  /** Specialisations — ServiceCategory-aligned strings. */
  specialisations: string[];
  /** Display rating 0–5. */
  rating: number;
  /** Number of jobs completed. */
  jobsCompleted: number;
  /** Languages spoken. */
  languages: string[];
  /** City slug the technician is primarily based in. */
  citySlug: string;
  /** Public-safe avatar URL. */
  avatar: string;
  /** One-line quote. */
  quote: string;
}

export const FEATURED_TECHNICIANS: FeaturedTechnician[] = [
  {
    id: 't1',
    name: 'Suresh K.',
    experienceYears: 12,
    specialisations: ['Split AC', 'Window AC', 'Gas refill'],
    rating: 4.9,
    jobsCompleted: 4820,
    languages: ['Kannada', 'Hindi', 'English'],
    citySlug: 'bengaluru',
    avatar: '/images/technicians/suresh.webp',
    quote: 'I treat every installation like it’s in my own home.',
  },
  {
    id: 't2',
    name: 'Mahesh P.',
    experienceYears: 9,
    specialisations: ['Front-load washer', 'PCB repair'],
    rating: 4.8,
    jobsCompleted: 3210,
    languages: ['Marathi', 'Hindi', 'English'],
    citySlug: 'mumbai',
    avatar: '/images/technicians/mahesh.webp',
    quote: 'A clean job site matters as much as the repair itself.',
  },
  {
    id: 't3',
    name: 'Rakesh S.',
    experienceYears: 14,
    specialisations: ['Refrigerator', 'Compressor', 'Gas leak'],
    rating: 4.9,
    jobsCompleted: 5160,
    languages: ['Hindi', 'English'],
    citySlug: 'delhi',
    avatar: '/images/technicians/rakesh.webp',
    quote: 'I never sell a part you don’t need.',
  },
  {
    id: 't4',
    name: 'Vidya M.',
    experienceYears: 7,
    specialisations: ['Microwave', 'Chimney', 'Geyser'],
    rating: 4.8,
    jobsCompleted: 2480,
    languages: ['Kannada', 'Tamil', 'English'],
    citySlug: 'bengaluru',
    avatar: '/images/technicians/vidya.webp',
    quote: 'Every customer leaves with a printed warranty card.',
  },
];
