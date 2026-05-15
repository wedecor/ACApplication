/**
 * City catalogue.
 *
 * Each entry powers a `/[city]` landing page and contributes to the
 * `/[city]/[service]` programmatic SEO matrix. These cities mirror the
 * tenant's seeded `City` rows but contain marketing-only metadata
 * (areas, neighbourhoods, hero copy, latitude/longitude for
 * LocalBusiness JSON-LD).
 *
 * The `id` is left optional and is resolved at runtime via the
 * `/cities` API when present — for SSG we ship slug + display name and
 * the booking funnel re-resolves the live `cityId` server-side.
 */

export interface CityArea {
  /** URL slug — `/areas/${slug}`. */
  slug: string;
  /** Display name (e.g. "Whitefield"). */
  name: string;
  /** Postal code(s) (used for OG copy + LocalBusiness `areaServed`). */
  pincodes: string[];
}

export interface City {
  slug: string;
  name: string;
  state: string;
  /** Centre point used for LocalBusiness JSON-LD. */
  latitude: number;
  longitude: number;
  /** Areas / neighbourhoods that get their own SEO pages. */
  areas: CityArea[];
  /** Average response time in minutes (marketing copy). */
  avgResponseMin: number;
  /** Number of completed bookings — refreshed by a build-time job. */
  completedBookings: number;
  /** Display rating, 0–5. */
  rating: number;
  /** Total review count for AggregateRating JSON-LD. */
  reviewCount: number;
  /** Whether the city is currently serviced (false → "coming soon"). */
  isLive: boolean;
}

export const CITIES: City[] = [
  {
    slug: 'bengaluru',
    name: 'Bengaluru',
    state: 'Karnataka',
    latitude: 12.9716,
    longitude: 77.5946,
    avgResponseMin: 60,
    completedBookings: 48200,
    rating: 4.8,
    reviewCount: 12450,
    isLive: true,
    areas: [
      { slug: 'whitefield', name: 'Whitefield', pincodes: ['560066', '560067'] },
      { slug: 'koramangala', name: 'Koramangala', pincodes: ['560034', '560095'] },
      { slug: 'indiranagar', name: 'Indiranagar', pincodes: ['560038'] },
      { slug: 'hsr-layout', name: 'HSR Layout', pincodes: ['560102'] },
      { slug: 'bellandur', name: 'Bellandur', pincodes: ['560103'] },
      { slug: 'electronic-city', name: 'Electronic City', pincodes: ['560100'] },
      { slug: 'marathahalli', name: 'Marathahalli', pincodes: ['560037'] },
      { slug: 'jayanagar', name: 'Jayanagar', pincodes: ['560011', '560041'] },
      { slug: 'jp-nagar', name: 'JP Nagar', pincodes: ['560078'] },
      { slug: 'btm-layout', name: 'BTM Layout', pincodes: ['560076'] },
      { slug: 'sarjapur-road', name: 'Sarjapur Road', pincodes: ['560035'] },
      { slug: 'hebbal', name: 'Hebbal', pincodes: ['560024'] },
    ],
  },
  {
    slug: 'mumbai',
    name: 'Mumbai',
    state: 'Maharashtra',
    latitude: 19.076,
    longitude: 72.8777,
    avgResponseMin: 75,
    completedBookings: 31200,
    rating: 4.7,
    reviewCount: 8980,
    isLive: true,
    areas: [
      { slug: 'andheri', name: 'Andheri', pincodes: ['400053', '400058'] },
      { slug: 'powai', name: 'Powai', pincodes: ['400076'] },
      { slug: 'bandra', name: 'Bandra', pincodes: ['400050'] },
      { slug: 'lower-parel', name: 'Lower Parel', pincodes: ['400013'] },
      { slug: 'malad', name: 'Malad', pincodes: ['400064'] },
      { slug: 'thane', name: 'Thane', pincodes: ['400601', '400607'] },
      { slug: 'navi-mumbai', name: 'Navi Mumbai', pincodes: ['400703'] },
      { slug: 'goregaon', name: 'Goregaon', pincodes: ['400063'] },
    ],
  },
  {
    slug: 'delhi',
    name: 'Delhi NCR',
    state: 'Delhi',
    latitude: 28.6139,
    longitude: 77.209,
    avgResponseMin: 70,
    completedBookings: 35600,
    rating: 4.7,
    reviewCount: 9650,
    isLive: true,
    areas: [
      { slug: 'gurgaon', name: 'Gurgaon', pincodes: ['122001', '122002'] },
      { slug: 'noida', name: 'Noida', pincodes: ['201301', '201304'] },
      { slug: 'dwarka', name: 'Dwarka', pincodes: ['110075'] },
      { slug: 'rohini', name: 'Rohini', pincodes: ['110085'] },
      { slug: 'south-extension', name: 'South Extension', pincodes: ['110049'] },
      { slug: 'saket', name: 'Saket', pincodes: ['110017'] },
      { slug: 'connaught-place', name: 'Connaught Place', pincodes: ['110001'] },
      { slug: 'lajpat-nagar', name: 'Lajpat Nagar', pincodes: ['110024'] },
    ],
  },
  {
    slug: 'hyderabad',
    name: 'Hyderabad',
    state: 'Telangana',
    latitude: 17.385,
    longitude: 78.4867,
    avgResponseMin: 75,
    completedBookings: 18900,
    rating: 4.6,
    reviewCount: 5410,
    isLive: false,
    areas: [
      { slug: 'gachibowli', name: 'Gachibowli', pincodes: ['500032'] },
      { slug: 'hitec-city', name: 'HITEC City', pincodes: ['500081'] },
      { slug: 'banjara-hills', name: 'Banjara Hills', pincodes: ['500034'] },
    ],
  },
  {
    slug: 'chennai',
    name: 'Chennai',
    state: 'Tamil Nadu',
    latitude: 13.0827,
    longitude: 80.2707,
    avgResponseMin: 80,
    completedBookings: 14300,
    rating: 4.6,
    reviewCount: 3890,
    isLive: false,
    areas: [
      { slug: 'velachery', name: 'Velachery', pincodes: ['600042'] },
      { slug: 'anna-nagar', name: 'Anna Nagar', pincodes: ['600040'] },
      { slug: 'omr', name: 'OMR', pincodes: ['600097'] },
    ],
  },
];

const CITY_BY_SLUG = new Map(CITIES.map((c) => [c.slug, c] as const));
const AREA_INDEX = new Map<string, { city: City; area: CityArea }>();
for (const city of CITIES) {
  for (const area of city.areas) {
    AREA_INDEX.set(`${city.slug}/${area.slug}`, { city, area });
    AREA_INDEX.set(area.slug, { city, area });
  }
}

export function getCityBySlug(slug: string): City | null {
  return CITY_BY_SLUG.get(slug) ?? null;
}

export function getLiveCities(): City[] {
  return CITIES.filter((c) => c.isLive);
}

export function getAreaBySlug(citySlug: string, areaSlug: string): { city: City; area: CityArea } | null {
  return AREA_INDEX.get(`${citySlug}/${areaSlug}`) ?? null;
}

export function findAreaAnywhere(slug: string): { city: City; area: CityArea } | null {
  return AREA_INDEX.get(slug) ?? null;
}

/** Used by /sitemap.xml + generateStaticParams. */
export function getAllCityAreaSlugs(): Array<{ citySlug: string; areaSlug: string }> {
  return CITIES.flatMap((city) =>
    city.areas.map((area) => ({ citySlug: city.slug, areaSlug: area.slug })),
  );
}
