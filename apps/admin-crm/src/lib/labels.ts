/**
 * Human labels for enum values shown in the UI. Prefer these over
 * `value.replace(/_/g, ' ').toLowerCase()`, which mangles acronyms and brands.
 */

/** "WAITING_PARTS" → "Waiting parts" (fallback for enums without a curated label). */
export function humanizeEnum(value: string | null | undefined): string {
  if (!value) return '—';
  const s = value.replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const CATEGORY: Record<string, string> = {
  AC_REPAIR: 'AC repair',
  AC_INSTALLATION: 'AC installation',
  AC_SERVICING: 'AC servicing',
  REFRIGERATOR: 'Refrigerator',
  WASHING_MACHINE: 'Washing machine',
  MICROWAVE: 'Microwave',
  GEYSER: 'Geyser',
  CHIMNEY: 'Chimney',
  TELEVISION: 'Television',
  WATER_PURIFIER: 'Water purifier (RO)',
  DISHWASHER: 'Dishwasher',
  AIR_COOLER: 'Air cooler',
  INVERTER_UPS: 'Inverter / UPS',
  CEILING_FAN: 'Ceiling fan',
  OVEN: 'Oven',
  VACUUM_CLEANER: 'Vacuum cleaner',
  ELECTRICAL_WIRING: 'Electrical wiring',
  OTHER: 'Other',
};

export function categoryLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return CATEGORY[value] ?? humanizeEnum(value);
}

const LEAD_SOURCE: Record<string, string> = {
  WEBSITE: 'Website',
  WHATSAPP: 'WhatsApp',
  GOOGLE_ADS: 'Google Ads',
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  CALL: 'Phone call',
  MANUAL: 'Manual entry',
  REFERRAL: 'Referral',
};

export function leadSourceLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return LEAD_SOURCE[value] ?? humanizeEnum(value);
}
