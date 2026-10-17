/**
 * Catalogue of bookable appliances + canonical issues per appliance.
 *
 * Keep in sync with the public website's `services` content layer. Mobile
 * clients prefer this static catalogue (small, instant) over a network
 * round-trip for the appliance picker step in booking. Pricing is fetched
 * live from `/v1/me/bookings/estimate` once the user picks an issue.
 */
/** Mirrors the server `ServiceCategory` enum exactly (no client-only aliases). */
export type ServiceCategory =
  | 'AC_REPAIR'
  | 'AC_INSTALLATION'
  | 'AC_SERVICING'
  | 'REFRIGERATOR'
  | 'WASHING_MACHINE'
  | 'MICROWAVE'
  | 'GEYSER'
  | 'CHIMNEY'
  | 'TELEVISION'
  | 'WATER_PURIFIER'
  | 'DISHWASHER'
  | 'AIR_COOLER'
  | 'INVERTER_UPS'
  | 'CEILING_FAN'
  | 'OVEN'
  | 'VACUUM_CLEANER'
  | 'ELECTRICAL_WIRING'
  | 'OTHER';

export interface Appliance {
  id: string;
  category: ServiceCategory;
  name: string;
  emoji: string;
  estStartingMinor: number;
  visitMinutes: number;
  emergencyAvailable: boolean;
  issues: ApplianceIssue[];
}

export interface ApplianceIssue {
  id: string;
  label: string;
  description?: string;
  estMinor?: number;
  emergency?: boolean;
}

export const APPLIANCES: Appliance[] = [
  {
    id: 'ac',
    category: 'AC_REPAIR',
    name: 'Air Conditioner',
    emoji: '\u2744\uFE0F',
    estStartingMinor: 39900,
    visitMinutes: 60,
    emergencyAvailable: true,
    issues: [
      { id: 'no-cooling', label: 'AC not cooling', estMinor: 49900, emergency: true },
      { id: 'water-leak', label: 'Water leakage', estMinor: 49900 },
      { id: 'foul-smell', label: 'Foul smell from AC' },
      { id: 'remote-not-working', label: 'Remote not working' },
      { id: 'noise', label: 'Loud / abnormal noise' },
      { id: 'gas-refill', label: 'Gas refill', estMinor: 249900 },
      { id: 'general-service', label: 'General servicing', estMinor: 59900 },
      { id: 'installation', label: 'Install / Uninstall' },
    ],
  },
  {
    id: 'washing-machine',
    category: 'WASHING_MACHINE',
    name: 'Washing Machine',
    emoji: '\uD83E\uDDFA',
    estStartingMinor: 34900,
    visitMinutes: 60,
    emergencyAvailable: false,
    issues: [
      { id: 'not-spinning', label: 'Not spinning' },
      { id: 'not-draining', label: 'Not draining water' },
      { id: 'error-code', label: 'Error code on display' },
      { id: 'noisy', label: 'Excessive noise / vibration' },
      { id: 'door-stuck', label: 'Door stuck / not opening' },
      { id: 'installation', label: 'Install / Uninstall' },
    ],
  },
  {
    id: 'refrigerator',
    category: 'REFRIGERATOR',
    name: 'Refrigerator',
    emoji: '\u2744\uFE0F',
    estStartingMinor: 39900,
    visitMinutes: 60,
    emergencyAvailable: true,
    issues: [
      { id: 'no-cooling', label: 'Not cooling', emergency: true },
      { id: 'ice-buildup', label: 'Ice buildup in freezer' },
      { id: 'water-leak', label: 'Water leaking' },
      { id: 'noisy', label: 'Loud or buzzing noise' },
      { id: 'gas-refill', label: 'Gas refill' },
      { id: 'door-seal', label: 'Door not sealing' },
    ],
  },
  {
    id: 'microwave',
    category: 'MICROWAVE',
    name: 'Microwave',
    emoji: '\uD83C\uDF7D\uFE0F',
    estStartingMinor: 29900,
    visitMinutes: 45,
    emergencyAvailable: false,
    issues: [
      { id: 'not-heating', label: 'Not heating food' },
      { id: 'sparking', label: 'Sparking inside' },
      { id: 'no-power', label: 'No power / display dead' },
      { id: 'door-issue', label: 'Door / latch issue' },
    ],
  },
  {
    id: 'tv',
    category: 'TELEVISION',
    name: 'Television',
    emoji: '\uD83D\uDCFA',
    estStartingMinor: 49900,
    visitMinutes: 45,
    emergencyAvailable: false,
    issues: [
      { id: 'no-display', label: 'No display / blank screen' },
      { id: 'no-sound', label: 'No sound' },
      { id: 'lines-screen', label: 'Lines on screen' },
      { id: 'wifi', label: 'Smart TV / Wi-Fi issue' },
      { id: 'wall-mount', label: 'Wall mounting' },
    ],
  },
  {
    id: 'geyser',
    category: 'GEYSER',
    name: 'Geyser',
    emoji: '\uD83D\uDEBF',
    estStartingMinor: 24900,
    visitMinutes: 45,
    emergencyAvailable: true,
    issues: [
      { id: 'no-hot-water', label: 'No hot water', emergency: true },
      { id: 'leakage', label: 'Water leakage' },
      { id: 'noise', label: 'Noisy operation' },
      { id: 'installation', label: 'Install / Uninstall' },
    ],
  },
  {
    id: 'water-purifier',
    category: 'WATER_PURIFIER',
    name: 'Water Purifier',
    emoji: '\uD83D\uDCA7',
    estStartingMinor: 29900,
    visitMinutes: 45,
    emergencyAvailable: false,
    issues: [
      { id: 'no-water', label: 'No water flow' },
      { id: 'bad-taste', label: 'Bad taste / smell' },
      { id: 'leakage', label: 'Water leakage' },
      { id: 'filter-change', label: 'Filter / membrane change' },
      { id: 'installation', label: 'Install / Uninstall' },
    ],
  },
  {
    id: 'chimney',
    category: 'CHIMNEY',
    name: 'Kitchen Chimney',
    emoji: '\uD83C\uDF73',
    estStartingMinor: 39900,
    visitMinutes: 60,
    emergencyAvailable: false,
    issues: [
      { id: 'weak-suction', label: 'Weak suction' },
      { id: 'deep-cleaning', label: 'Deep cleaning' },
      { id: 'noise', label: 'Loud noise' },
      { id: 'installation', label: 'Install / Uninstall' },
    ],
  },
  {
    id: 'dishwasher',
    category: 'DISHWASHER',
    name: 'Dishwasher',
    emoji: '\uD83C\uDF7D\uFE0F',
    estStartingMinor: 44900,
    visitMinutes: 60,
    emergencyAvailable: false,
    issues: [
      { id: 'not-cleaning', label: 'Dishes not clean' },
      { id: 'not-draining', label: 'Not draining' },
      { id: 'error-code', label: 'Error code on display' },
      { id: 'leakage', label: 'Water leakage' },
    ],
  },
  {
    id: 'air-cooler',
    category: 'AIR_COOLER',
    name: 'Air Cooler',
    emoji: '\uD83C\uDF2C\uFE0F',
    estStartingMinor: 29900,
    visitMinutes: 45,
    emergencyAvailable: false,
    issues: [
      { id: 'not-cooling', label: 'Not cooling' },
      { id: 'pump-issue', label: 'Water pump not working' },
      { id: 'motor-issue', label: 'Fan / motor issue' },
      { id: 'servicing', label: 'General servicing' },
    ],
  },
  {
    id: 'inverter-ups',
    category: 'INVERTER_UPS',
    name: 'Inverter / UPS',
    emoji: '\uD83D\uDD0B',
    estStartingMinor: 34900,
    visitMinutes: 45,
    emergencyAvailable: true,
    issues: [
      { id: 'no-backup', label: 'No / low backup', emergency: true },
      { id: 'beeping', label: 'Continuous beeping' },
      { id: 'battery-check', label: 'Battery check / water top-up' },
      { id: 'installation', label: 'Install / Uninstall' },
    ],
  },
  {
    id: 'ceiling-fan',
    category: 'CEILING_FAN',
    name: 'Ceiling Fan',
    emoji: '\uD83C\uDF00',
    estStartingMinor: 19900,
    visitMinutes: 30,
    emergencyAvailable: false,
    issues: [
      { id: 'not-running', label: 'Not running' },
      { id: 'slow-speed', label: 'Running slow' },
      { id: 'noise', label: 'Noise / wobbling' },
      { id: 'installation', label: 'Install / Uninstall' },
    ],
  },
  {
    id: 'oven',
    category: 'OVEN',
    name: 'Oven / OTG',
    emoji: '\uD83E\uDD67',
    estStartingMinor: 34900,
    visitMinutes: 45,
    emergencyAvailable: false,
    issues: [
      { id: 'not-heating', label: 'Not heating' },
      { id: 'uneven-heating', label: 'Uneven heating' },
      { id: 'timer-issue', label: 'Timer / thermostat issue' },
    ],
  },
  {
    id: 'vacuum-cleaner',
    category: 'VACUUM_CLEANER',
    name: 'Vacuum Cleaner',
    emoji: '\uD83E\uDDF9',
    estStartingMinor: 29900,
    visitMinutes: 45,
    emergencyAvailable: false,
    issues: [
      { id: 'weak-suction', label: 'Weak suction' },
      { id: 'not-starting', label: 'Not starting' },
      { id: 'battery', label: 'Battery not charging' },
    ],
  },
  {
    id: 'electrical-wiring',
    category: 'ELECTRICAL_WIRING',
    name: 'Electrical & Wiring',
    emoji: '\u26A1',
    estStartingMinor: 29900,
    visitMinutes: 60,
    emergencyAvailable: true,
    issues: [
      { id: 'short-circuit', label: 'Short circuit / tripping', emergency: true },
      { id: 'switchboard', label: 'Switch / socket repair' },
      { id: 'new-point', label: 'New wiring point' },
      { id: 'mcb', label: 'MCB / DB issue' },
    ],
  },
];

export function getAppliance(id: string): Appliance | undefined {
  return APPLIANCES.find((a) => a.id === id);
}

export function getIssue(applianceId: string, issueId: string): ApplianceIssue | undefined {
  return getAppliance(applianceId)?.issues.find((i) => i.id === issueId);
}

/** Appliance in the catalogue that books the given server category (AC_* → AC). */
export function getApplianceByCategory(category: string): Appliance | undefined {
  if (category.startsWith('AC_')) return APPLIANCES.find((a) => a.id === 'ac');
  return APPLIANCES.find((a) => a.category === category);
}

/** Picker options for registering an appliance ("My appliances"). */
export const APPLIANCE_CATEGORY_OPTIONS: { category: ServiceCategory; label: string; emoji: string }[] = [
  ...APPLIANCES.filter((a) => a.category !== 'ELECTRICAL_WIRING').map((a) => ({
    category: a.category,
    label: a.name,
    emoji: a.emoji,
  })),
  { category: 'OTHER', label: 'Other', emoji: '\uD83D\uDD27' },
];
