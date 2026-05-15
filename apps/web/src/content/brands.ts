/**
 * Brand catalogue — used by `/brands/[slug]` programmatic SEO pages.
 *
 * Each brand maps to one or more `ServiceCategory` values via the
 * `services` array. The brand page renders a unified landing that
 * covers every appliance that brand makes — e.g. /brands/lg covers AC,
 * fridge, washing-machine repairs all on one URL — plus per-service
 * sub-pages at /brands/[brand]/[service].
 */

import type { ServiceCategory } from '@ac/types';

export interface Brand {
  slug: string;
  name: string;
  /** Optional alternative names for SEO copy ("LG Electronics"). */
  longName?: string;
  /** ServiceCategories this brand makes / we service. */
  services: ServiceCategory[];
  /** Headline marketing line. */
  tagline: string;
  /** Common error codes — fuels long-tail "lg ac error code e1" queries. */
  commonErrorCodes?: Array<{ code: string; meaning: string }>;
  /** Models we explicitly support — surfaces in SEO copy. */
  popularModels?: string[];
  /** Trust line — total repairs done for this brand. */
  repairsCompleted: number;
}

export const BRANDS: Brand[] = [
  {
    slug: 'lg',
    name: 'LG',
    longName: 'LG Electronics',
    tagline: 'Authorised-grade LG repairs at home — same day.',
    services: ['AC_REPAIR', 'AC_INSTALLATION', 'AC_SERVICING', 'REFRIGERATOR', 'WASHING_MACHINE', 'MICROWAVE'],
    repairsCompleted: 14820,
    commonErrorCodes: [
      { code: 'CH 01', meaning: 'Indoor air-sensor short / open circuit.' },
      { code: 'CH 05', meaning: 'Communication failure between indoor & outdoor unit.' },
      { code: 'CH 38', meaning: 'Outdoor pipe temperature sensor fault.' },
      { code: 'OE', meaning: 'Washing machine drain pump blocked.' },
      { code: 'UE', meaning: 'Unbalanced load on washing machine drum.' },
    ],
    popularModels: ['Dual Inverter', 'Wi-Fi ThinQ', 'GLI-G292', 'T80SJSF1Z'],
  },
  {
    slug: 'samsung',
    name: 'Samsung',
    tagline: 'Same-day Samsung service for AC, fridge and washing-machine.',
    services: ['AC_REPAIR', 'AC_INSTALLATION', 'AC_SERVICING', 'REFRIGERATOR', 'WASHING_MACHINE', 'MICROWAVE'],
    repairsCompleted: 13560,
    commonErrorCodes: [
      { code: 'E1-21', meaning: 'AC indoor temperature sensor error.' },
      { code: 'E5-22', meaning: 'AC outdoor inverter PFC error.' },
      { code: '4E', meaning: 'Washing machine water supply error.' },
      { code: 'OF', meaning: 'Refrigerator forced defrost mode.' },
    ],
    popularModels: ['WindFree', 'Bespoke', 'Digital Inverter'],
  },
  {
    slug: 'daikin',
    name: 'Daikin',
    tagline: 'Trained Daikin technicians — VRV, split & cassette experts.',
    services: ['AC_REPAIR', 'AC_INSTALLATION', 'AC_SERVICING'],
    repairsCompleted: 6820,
    popularModels: ['FTKM', 'FTKF', 'Cassette FCQ'],
  },
  {
    slug: 'voltas',
    name: 'Voltas',
    tagline: 'Voltas window & split AC repair, installation and servicing.',
    services: ['AC_REPAIR', 'AC_INSTALLATION', 'AC_SERVICING'],
    repairsCompleted: 11220,
    popularModels: ['Vertis', 'Maha Adjustable', 'SAC Inverter'],
  },
  {
    slug: 'bluestar',
    name: 'Blue Star',
    tagline: 'Blue Star residential & light-commercial AC service.',
    services: ['AC_REPAIR', 'AC_INSTALLATION', 'AC_SERVICING'],
    repairsCompleted: 7240,
    popularModels: ['IC318', 'NC312', 'Cassette VFR'],
  },
  {
    slug: 'hitachi',
    name: 'Hitachi',
    tagline: 'Hitachi AC, window & split — repair and chemical service.',
    services: ['AC_REPAIR', 'AC_INSTALLATION', 'AC_SERVICING'],
    repairsCompleted: 4980,
  },
  {
    slug: 'panasonic',
    name: 'Panasonic',
    tagline: 'Panasonic AC, fridge and microwave — full-stack repair.',
    services: ['AC_REPAIR', 'REFRIGERATOR', 'MICROWAVE'],
    repairsCompleted: 5630,
  },
  {
    slug: 'whirlpool',
    name: 'Whirlpool',
    tagline: 'Whirlpool washing machine and fridge — repair experts.',
    services: ['WASHING_MACHINE', 'REFRIGERATOR'],
    repairsCompleted: 8410,
  },
  {
    slug: 'ifb',
    name: 'IFB',
    tagline: 'IFB washing-machine & microwave — authorised-grade service.',
    services: ['WASHING_MACHINE', 'MICROWAVE'],
    repairsCompleted: 6240,
  },
  {
    slug: 'bosch',
    name: 'Bosch',
    tagline: 'Bosch washing machines & fridges, repaired at home.',
    services: ['WASHING_MACHINE', 'REFRIGERATOR'],
    repairsCompleted: 4720,
  },
  {
    slug: 'godrej',
    name: 'Godrej',
    tagline: 'Godrej fridge & washing-machine repair — trained experts.',
    services: ['REFRIGERATOR', 'WASHING_MACHINE'],
    repairsCompleted: 5980,
  },
  {
    slug: 'haier',
    name: 'Haier',
    tagline: 'Haier fridge & washing-machine service experts.',
    services: ['REFRIGERATOR', 'WASHING_MACHINE'],
    repairsCompleted: 4060,
  },
  {
    slug: 'ao-smith',
    name: 'AO Smith',
    tagline: 'AO Smith water-heater repair & servicing.',
    services: ['GEYSER'],
    repairsCompleted: 2980,
  },
  {
    slug: 'racold',
    name: 'Racold',
    tagline: 'Racold geyser repair & anode service.',
    services: ['GEYSER'],
    repairsCompleted: 2480,
  },
  {
    slug: 'faber',
    name: 'Faber',
    tagline: 'Faber kitchen chimney service & deep clean.',
    services: ['CHIMNEY'],
    repairsCompleted: 3640,
  },
  {
    slug: 'elica',
    name: 'Elica',
    tagline: 'Elica auto-clean and conventional chimney service.',
    services: ['CHIMNEY'],
    repairsCompleted: 3120,
  },
];

const BRAND_BY_SLUG = new Map(BRANDS.map((b) => [b.slug, b] as const));

export function getBrandBySlug(slug: string): Brand | null {
  return BRAND_BY_SLUG.get(slug) ?? null;
}

export function getAllBrandSlugs(): string[] {
  return BRANDS.map((b) => b.slug);
}
