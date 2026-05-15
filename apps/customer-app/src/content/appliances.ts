/**
 * Catalogue of bookable appliances + canonical issues per appliance.
 *
 * Keep in sync with the public website's `services` content layer. Mobile
 * clients prefer this static catalogue (small, instant) over a network
 * round-trip for the appliance picker step in booking. Pricing is fetched
 * live from `/v1/services/estimate` once the user picks an issue.
 */
export type ServiceCategory =
  | 'AC_REPAIR'
  | 'AC_INSTALLATION'
  | 'AC_SERVICING'
  | 'WASHING_MACHINE_REPAIR'
  | 'REFRIGERATOR_REPAIR'
  | 'MICROWAVE_REPAIR'
  | 'TV_REPAIR'
  | 'GEYSER_REPAIR';

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
    category: 'WASHING_MACHINE_REPAIR',
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
    category: 'REFRIGERATOR_REPAIR',
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
    category: 'MICROWAVE_REPAIR',
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
    category: 'TV_REPAIR',
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
    category: 'GEYSER_REPAIR',
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
];

export function getAppliance(id: string): Appliance | undefined {
  return APPLIANCES.find((a) => a.id === id);
}

export function getIssue(applianceId: string, issueId: string): ApplianceIssue | undefined {
  return getAppliance(applianceId)?.issues.find((i) => i.id === issueId);
}
