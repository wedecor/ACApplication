/**
 * DEMO DATA seed — fills every admin-CRM screen with believable content for
 * design reviews. Runs AFTER the base seed (`pnpm --filter @ac/database seed`)
 * and only looks up the base entities (tenant, cities, roles, staff, AMC
 * plans, service catalog, fault codes, checklists); it never recreates them.
 *
 *   pnpm --filter @ac/database seed:demo            # insert demo rows (idempotent)
 *   pnpm --filter @ac/database seed:demo --reset    # delete demo rows only
 *   pnpm --filter @ac/database seed:demo --fresh    # reset, then insert (re-anchors dates to today)
 *
 * Tagging / idempotency:
 *   * Every demo row has a deterministic primary key starting with `demo_`
 *     (e.g. `demo_book_017`). Inserts use `createMany({ skipDuplicates: true })`
 *     so re-running is a no-op for rows that already exist.
 *   * Demo phones live in the reserved range +91 90000 0xxxx; staff /
 *     technician employee codes start with `DEMO-`; document numbers use the
 *     `9xxxxx` sequence block (INV-2026-900001, TKT-2026-900001, …) so they
 *     never collide with the API's sequential numbering.
 *   * `--reset` deletes rows whose id starts with `demo_` (plus rows the API
 *     may have attached to demo customers / bookings), children first.
 *
 * Dates are anchored to "now" at insert time: ~45 days of history through the
 * next 7 days. Use `--fresh` to re-anchor an old demo dataset.
 */
import {
  type ActivityType,
  type BookingPriority,
  type BookingStatus,
  type InvoiceStatus,
  type LeadSource,
  type LeadStatus,
  type PaymentMethod,
  type Prisma,
  PrismaClient,
  type ServiceCategory,
  type ServiceMode,
  type TechnicianStatus,
  type TicketPriority,
  type TicketSource,
  type TicketStatus,
  type UserRole,
  type WorkshopJobStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================================
// Helpers
// ============================================================================

const P = 'demo_';
/** Deterministic demo id: did('book', 7) → demo_book_007. */
const did = (kind: string, n: number | string): string =>
  `${P}${kind}_${typeof n === 'number' ? String(n).padStart(3, '0') : n}`;

/** Seeded PRNG (mulberry32) so every run generates the same dataset. */
let prngState = 0x5eed2026;
function rand(): number {
  prngState = (prngState + 0x6d2b79f5) | 0;
  let t = Math.imul(prngState ^ (prngState >>> 15), 1 | prngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (min: number, max: number): number => Math.floor(rand() * (max - min + 1)) + min;
const chance = (p: number): boolean => rand() < p;
function pick<T>(arr: readonly T[]): T {
  const v = arr[Math.floor(rand() * arr.length)];
  if (v === undefined) throw new Error('pick() on empty array');
  return v;
}
/** Wrap-around index access that satisfies noUncheckedIndexedAccess. */
function at<T>(arr: readonly T[], i: number): T {
  const v = arr[((i % arr.length) + arr.length) % arr.length];
  if (v === undefined) throw new Error('at() on empty array');
  return v;
}
function must<T>(v: T | undefined | null, what: string): T {
  if (v === undefined || v === null) {
    throw new Error(`Demo seed: missing ${what}. Run the base seed first: pnpm --filter @ac/database seed`);
  }
  return v;
}
function weighted<T>(entries: readonly (readonly [T, number])[]): T {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [v, w] of entries) {
    r -= w;
    if (r <= 0) return v;
  }
  return must(entries[entries.length - 1], 'weighted entry')[0];
}
const alnum = (len: number): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(rand() * chars.length)];
  return s;
};

const NOW = new Date();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const IST_OFFSET = 330 * MIN;
const YEAR = new Date(NOW.getTime() + IST_OFFSET).getUTCFullYear();
/** A wall-clock time in IST, `dayOffset` days from today. */
function istAt(dayOffset: number, hour: number, minute = 0): Date {
  const ist = new Date(NOW.getTime() + IST_OFFSET);
  return new Date(
    Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + dayOffset, hour, minute) - IST_OFFSET,
  );
}
const ago = (ms: number): Date => new Date(NOW.getTime() - ms);
const plus = (d: Date, ms: number): Date => new Date(d.getTime() + ms);
const minDate = (a: Date, b: Date): Date => (a < b ? a : b);
const notFuture = (d: Date): Date => minDate(d, ago(MIN));
const istHour = (d: Date): number => new Date(d.getTime() + IST_OFFSET).getUTCHours();
/** UTC-midnight date for @db.Date columns. */
const dateOnly = (d: Date): Date => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/** ₹ → paise. */
const inr = (rupees: number): number => Math.round(rupees * 100);
/** Reserved demo phone range: +91 90000 0xxxx. */
const demoPhone = (n: number): string => `+91${9000000000 + n}`;
/** Document number in the reserved 9xxxxx block. */
const docNo = (prefix: string, n: number): string => `${prefix}-${YEAR}-${900000 + n}`;
const fam = (c: string): string => (c.startsWith('AC_') ? 'AC' : c);
const slotLabel = (d: Date): string => {
  const h = istHour(d);
  const start = h % 2 === 0 ? h : h - 1;
  return `${String(start).padStart(2, '0')}:00-${String(start + 2).padStart(2, '0')}:00`;
};
const img = (text: string): string => `https://placehold.co/800x600/png?text=${encodeURIComponent(text)}`;
const json = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

// ============================================================================
// Reference data
// ============================================================================

interface Locality {
  name: string;
  pincode: string;
  lat: number;
  lng: number;
}
interface CitySpec {
  name: 'Bengaluru' | 'Mumbai' | 'Delhi';
  state: string;
  stateCode: string;
  gstState: string;
  lat: number;
  lng: number;
  localities: Locality[];
  buildings: string[];
  streets: string[];
  landmarks: string[];
}

const CITY_SPECS: CitySpec[] = [
  {
    name: 'Bengaluru',
    state: 'Karnataka',
    stateCode: 'KA',
    gstState: '29',
    lat: 12.9716,
    lng: 77.5946,
    localities: [
      { name: 'Koramangala 5th Block', pincode: '560095', lat: 12.9352, lng: 77.6245 },
      { name: 'Indiranagar', pincode: '560038', lat: 12.9784, lng: 77.6408 },
      { name: 'HSR Layout Sector 2', pincode: '560102', lat: 12.9116, lng: 77.6474 },
      { name: 'Whitefield', pincode: '560066', lat: 12.9698, lng: 77.75 },
      { name: 'Jayanagar 4th Block', pincode: '560011', lat: 12.925, lng: 77.5938 },
      { name: 'JP Nagar 6th Phase', pincode: '560078', lat: 12.9063, lng: 77.5857 },
      { name: 'Malleshwaram', pincode: '560003', lat: 13.0035, lng: 77.571 },
      { name: 'Hebbal', pincode: '560024', lat: 13.0358, lng: 77.597 },
      { name: 'Electronic City Phase 1', pincode: '560100', lat: 12.8452, lng: 77.6602 },
      { name: 'Marathahalli', pincode: '560037', lat: 12.9591, lng: 77.6974 },
      { name: 'Bellandur', pincode: '560103', lat: 12.9257, lng: 77.6766 },
      { name: 'BTM Layout 2nd Stage', pincode: '560076', lat: 12.9166, lng: 77.6101 },
      { name: 'Rajajinagar', pincode: '560010', lat: 12.9915, lng: 77.556 },
      { name: 'Yelahanka New Town', pincode: '560064', lat: 13.1007, lng: 77.5963 },
      { name: 'Banashankari 3rd Stage', pincode: '560085', lat: 12.9255, lng: 77.5468 },
    ],
    buildings: [
      'Sobha Dream Acres',
      'Brigade Metropolis',
      'Purva Riviera',
      'Salarpuria Greenage',
      'Mantri Espana',
      'Adarsh Palm Retreat',
      'Shriram Greenfield',
      'Prestige Shantiniketan',
    ],
    streets: ['14th Cross, 6th Main', '80 Feet Road', '27th Main Road', '1st A Cross, 4th Stage', 'Outer Ring Road', 'CMH Road', '12th Main, 3rd Block'],
    landmarks: ['Near Forum Mall', 'Opp. Cafe Coffee Day', 'Behind BDA Complex', 'Near Metro Station', 'Next to Corporation Bank ATM', 'Opp. Ganesha Temple'],
  },
  {
    name: 'Mumbai',
    state: 'Maharashtra',
    stateCode: 'MH',
    gstState: '27',
    lat: 19.076,
    lng: 72.8777,
    localities: [
      { name: 'Andheri West', pincode: '400058', lat: 19.1364, lng: 72.8296 },
      { name: 'Bandra West', pincode: '400050', lat: 19.0596, lng: 72.8295 },
      { name: 'Powai', pincode: '400076', lat: 19.1176, lng: 72.906 },
      { name: 'Goregaon East', pincode: '400063', lat: 19.1663, lng: 72.8526 },
      { name: 'Malad West', pincode: '400064', lat: 19.1874, lng: 72.8484 },
      { name: 'Chembur', pincode: '400071', lat: 19.0522, lng: 72.9005 },
      { name: 'Dadar West', pincode: '400028', lat: 19.0178, lng: 72.8478 },
      { name: 'Borivali West', pincode: '400092', lat: 19.2307, lng: 72.8567 },
    ],
    buildings: ['Hiranandani Gardens, Eden', 'Lokhandwala Complex', 'Raheja Classique', 'Oberoi Splendor', 'Vasant Vihar CHS', 'Kalpataru Aura'],
    streets: ['SV Road', 'Linking Road', 'Hill Road', 'JP Road', 'LBS Marg', 'Carter Road'],
    landmarks: ['Near Infinity Mall', 'Opp. Shoppers Stop', 'Near Railway Station (West)', 'Behind Holy Family Church'],
  },
  {
    name: 'Delhi',
    state: 'Delhi',
    stateCode: 'DL',
    gstState: '07',
    lat: 28.6139,
    lng: 77.209,
    localities: [
      { name: 'Dwarka Sector 10', pincode: '110075', lat: 28.5823, lng: 77.05 },
      { name: 'Rohini Sector 9', pincode: '110085', lat: 28.7158, lng: 77.121 },
      { name: 'Saket', pincode: '110017', lat: 28.5245, lng: 77.2066 },
      { name: 'Lajpat Nagar II', pincode: '110024', lat: 28.5677, lng: 77.2433 },
      { name: 'Mayur Vihar Phase 1', pincode: '110091', lat: 28.6045, lng: 77.294 },
      { name: 'Janakpuri', pincode: '110058', lat: 28.6219, lng: 77.0878 },
      { name: 'Vasant Kunj', pincode: '110070', lat: 28.5293, lng: 77.152 },
    ],
    buildings: ['DDA SFS Flats', 'Pocket B-4', 'Shivalik Apartments', 'Nav Sansad Vihar', 'Ashoka Enclave'],
    streets: ['Main Market Road', 'Ring Road', 'Block C Lane 3', 'Aurobindo Marg'],
    landmarks: ['Near Select Citywalk', 'Opp. Metro Pillar 812', 'Near Gurudwara', 'Behind Mother Dairy Booth'],
  },
];

const CUSTOMER_NAMES = [
  // Bengaluru (0–24)
  'Aarav Sharma', 'Priya Raghavan', 'Rohan Kulkarni', 'Ananya Iyer', 'Vikram Reddy',
  'Sneha Patil', 'Karthik Subramanian', 'Meera Nair', 'Arjun Mehta', 'Divya Hegde',
  'Siddharth Rao', 'Kavya Menon', 'Rahul Deshpande', 'Pooja Venkatesh', 'Aditya Joshi',
  'Lakshmi Narasimhan', 'Nikhil Gowda', 'Shreya Bhat', 'Varun Krishnan', 'Neha Agarwal',
  'Venkatasubramanian Raghunathan Iyer', 'Fatima Sheikh', 'Manish Choudhary', 'Deepika Shetty', 'Imran Khan',
  // Mumbai (25–36)
  'Harpreet Kaur', 'Suresh Babu', 'Anjali Gupta', 'Prakash Naidu', 'Ritu Malhotra',
  'Gaurav Saxena', 'Swati Bansal', 'Mohammed Irfan', 'Kiran Kumar', 'Tanvi Sawant',
  'Abhishek Pandey', 'Nandini Rao',
  // Delhi (37–44)
  'Rajesh Pillai', 'Sunita Verma', 'Arvind Swaminathan', 'Lakshmi Narasimha Swamy Chakravarthy', 'Zoya Siddiqui',
  'Hemant Joshi', 'Bhavana Murthy', 'Sanjay Kapoor',
];
const cityIndexForCustomer = (i: number): number => (i < 25 ? 0 : i < 37 ? 1 : 2);

const PROSPECT_NAMES = [
  'Ramya Krishnamurthy', 'Ashok Bhandari', 'Sana Mirza', 'Girish Kamath', 'Payal Khanna',
  'Naveen Chandra', 'Ishita Banerjee', 'Yusuf Pathan', 'Bharath Shenoy', 'Chitra Sundaram',
  'Devendra Patil', 'Mehul Shah', 'Anusha Reddy', 'Tarun Bhatnagar', 'Revathi Ganesan',
  'Kunal Arora', 'Sowmya Prakash', 'Rakesh Mishra', 'Aisha Qureshi', 'Pranav Kulkarni',
  'Jyothi Lakshmi', 'Vivek Oberoi Sharma', 'Asdf Test', 'Free Recharge Offer', 'Unknown Caller',
  'Shobha Rani', 'Mithun Das', 'Keerthana Balasubramanian', 'Amitabh Srivastava',
];

type ModelSpec = readonly [brand: string, model: string, capacity: string];
const APPLIANCE_MODELS: Partial<Record<ServiceCategory, ModelSpec[]>> = {
  AC_REPAIR: [
    ['Daikin', 'FTKF50TV16U', '1.5 ton'],
    ['Voltas', '185V Vectra Elite', '1.5 ton'],
    ['LG', 'PS-Q19YNZE', '1.5 ton'],
    ['Samsung', 'AR18CYLZABE', '1.5 ton'],
    ['Daikin', 'FTKM35UV16V', '1 ton'],
    ['Voltas', '243V DZZ', '2 ton'],
    ['Whirlpool', '3D Cool Inverter 1.5T', '1.5 ton'],
    ['Godrej', 'GIC 18TTC3-WTA', '1.5 ton'],
    ['LG', 'RS-Q24ENXE', '2 ton'],
  ],
  REFRIGERATOR: [
    ['LG', 'GL-T292RPZY', '260 L'],
    ['Samsung', 'RT28A3453S8', '253 L'],
    ['Whirlpool', 'IF INV CNV 278', '265 L'],
    ['Godrej', 'RT EONVALOR 260C', '260 L'],
    ['Bosch', 'CTC27S03NI', '288 L'],
    ['Samsung', 'RS76CG8003S9', '653 L'],
  ],
  WASHING_MACHINE: [
    ['LG', 'FHM1207SDW', '7 kg'],
    ['IFB', 'Senator WXS 8014', '8 kg'],
    ['Samsung', 'WW80T504DAX', '8 kg'],
    ['Bosch', 'WAJ2416WIN', '7 kg'],
    ['Whirlpool', 'Stainwash Pro 7.5', '7.5 kg'],
    ['IFB', 'Diva Aqua VX', '6 kg'],
  ],
  TELEVISION: [
    ['Sony', 'KD-55X80L', '55 inch'],
    ['Samsung', 'UA43CUE60AKLXL', '43 inch'],
    ['LG', '43UR7500PSC', '43 inch'],
    ['Sony', 'KD-65X75L', '65 inch'],
    ['Samsung', 'QA55Q60CAKLXL', '55 inch'],
  ],
  WATER_PURIFIER: [
    ['Kent', 'Grand Plus RO+UV+UF', '8 L'],
    ['Aquaguard', 'Aura RO+UV+MTDS', '7 L'],
    ['Kent', 'Supreme Extra', '8 L'],
    ['Aquaguard', 'Marvel NXT', '6.2 L'],
  ],
  MICROWAVE: [
    ['LG', 'MC2846BG', '28 L'],
    ['Samsung', 'CE1041DSB2', '23 L'],
    ['IFB', '25SC4', '25 L'],
    ['Godrej', 'GMX 20SA2BLM', '20 L'],
  ],
  GEYSER: [
    ['Havells', 'Monza EC 15L', '15 L'],
    ['Havells', 'Instanio Prime 3L', '3 L'],
    ['Havells', 'Adonia Spin 25L', '25 L'],
  ],
  INVERTER_UPS: [
    ['Luminous', 'Zelio+ 1100', '900 VA'],
    ['Luminous', 'Eco Volt Neo 1050', '900 VA'],
  ],
  CHIMNEY: [
    ['Havells', 'Eterno 90 cm', '90 cm'],
    ['Bosch', 'DWB098D50I', '90 cm'],
  ],
  DISHWASHER: [
    ['Bosch', 'SMS66GI01I', '13 place'],
    ['IFB', 'Neptune VX Plus', '12 place'],
  ],
};
const APPLIANCE_WEIGHTS: readonly (readonly [ServiceCategory, number])[] = [
  ['AC_REPAIR', 34],
  ['REFRIGERATOR', 14],
  ['WASHING_MACHINE', 15],
  ['TELEVISION', 11],
  ['WATER_PURIFIER', 10],
  ['MICROWAVE', 7],
  ['GEYSER', 4],
  ['INVERTER_UPS', 2],
  ['CHIMNEY', 2],
  ['DISHWASHER', 1],
];
const ROOMS = ['Master bedroom', 'Living room', 'Kids room', 'Kitchen', 'Guest bedroom', 'Utility area', 'Study'];

const ISSUES: Record<string, string[]> = {
  AC: [
    'AC not cooling, only fan running',
    'Water dripping from indoor unit onto the wall',
    'Error code E4 blinking on the display',
    'Outdoor unit making a loud rattling noise',
    'Bad smell when AC is switched on',
    'Routine service before the season — 2 split units',
    'AC trips the MCB after about 10 minutes',
    'Cooling is weak in the afternoon, ok at night',
    'New split AC installation — copper piping already done by builder',
  ],
  REFRIGERATOR: ['Fridge not cooling, freezer is fine', 'Ice build-up in freezer, door not closing', 'Compressor clicking every few minutes', 'Water leaking under the vegetable tray'],
  WASHING_MACHINE: ['Drum not spinning, shows UE error', 'Water not draining (OE error)', 'Door lock not releasing after wash', 'Loud banging noise during spin cycle'],
  TELEVISION: ['Sound but no picture', 'Vertical lines on the screen', 'TV not turning on, red standby light blinking', 'Wall mounting for new 55 inch TV'],
  WATER_PURIFIER: ['Water tastes salty, TDS seems high', 'Very low water flow', 'Purifier leaking from the bottom', 'Filter change due — 1 year completed'],
  MICROWAVE: ['Microwave runs but does not heat', 'Sparking inside while heating', 'Turntable not rotating'],
  GEYSER: ['Water not heating', 'Geyser tripping the MCB', 'Leaking from the inlet valve'],
  INVERTER_UPS: ['Backup only 20 minutes', 'Inverter beeping continuously'],
  CHIMNEY: ['Low suction, smoke spreading in kitchen', 'Deep cleaning — oil dripping from filters'],
  DISHWASHER: ['Dishes not getting clean, white residue', 'Water remains at the bottom after cycle'],
};
const LONG_ISSUE =
  'The AC in the master bedroom starts cooling normally for about 20–25 minutes and then the outdoor unit stops completely while the indoor fan keeps running; after switching it off for an hour it works again for a while. This has been happening for the last two weeks, mostly in the afternoons. Last service was in March by another vendor who topped up gas without checking for leaks. Please send a senior technician, call 30 minutes before coming because the society needs a gate pass, and note that the outdoor unit is on the terrace — accessible only via the 14th floor service staircase.';

const SYMPTOMS: Record<string, string[]> = {
  AC: ['Not cooling', 'Ice on evaporator coil', 'Water leakage', 'Noisy outdoor unit', 'Error code on display', 'Low airflow'],
  REFRIGERATOR: ['Not cooling', 'Excess frost', 'Compressor clicking', 'Water leakage'],
  WASHING_MACHINE: ['Not draining', 'Not spinning', 'Door lock fault', 'Vibration / noise'],
  TELEVISION: ['No display', 'Lines on screen', 'No power'],
  WATER_PURIFIER: ['High TDS', 'Low flow', 'Leakage'],
  MICROWAVE: ['Not heating', 'Sparking'],
  GEYSER: ['Not heating', 'MCB tripping'],
  INVERTER_UPS: ['Low backup'],
  CHIMNEY: ['Low suction'],
  DISHWASHER: ['Poor wash', 'Not draining'],
};
const DIAGNOSES: Record<string, [diagnosis: string, rootCause: string, resolution: string][]> = {
  AC: [
    ['Low suction pressure (38 psi), oil marks at flare joint', 'Flare nut leak on outdoor service valve', 'Re-flared joint, nitrogen leak test, vacuum and full R32 charge'],
    ['Run capacitor bulged, compressor not starting', 'Capacitor failure due to voltage fluctuation', 'Replaced 35+2.5 MFD capacitor, advised stabiliser'],
    ['Indoor coil and filters heavily clogged', 'Service overdue (14 months)', 'Power-jet service, coil chemical wash, drain flush'],
    ['Drain pipe blocked with algae', 'No service in last season', 'Cleared drain line, fixed tray slope'],
  ],
  REFRIGERATOR: [
    ['Defrost heater open circuit', 'Heater element burnt', 'Replaced defrost heater, tested defrost cycle'],
    ['Relay/OLP failure', 'Voltage fluctuation', 'Replaced relay + OLP kit'],
  ],
  WASHING_MACHINE: [
    ['Drain filter choked with coins and lint', 'Items left in pockets', 'Cleaned filter and pump, test wash OK'],
    ['Door lock switch not engaging', 'Worn interlock', 'Replaced door lock interlock'],
  ],
  TELEVISION: [
    ['Backlight strips 3 & 5 dead', 'LED strip failure', 'Replaced full LED strip set'],
    ['Power board standby fine, main rail dead', 'Failed MOSFET on power board', 'Repaired power board'],
  ],
  WATER_PURIFIER: [['Output TDS 180 ppm', 'Membrane exhausted', 'Replaced membrane and pre-filters, TDS now 45 ppm']],
  MICROWAVE: [['HV diode shorted', 'Component failure', 'Replaced HV diode, magnetron tested OK']],
  GEYSER: [['Element open', 'Scale build-up on element', 'Replaced 2 kW element, descaled tank']],
  INVERTER_UPS: [['Battery specific gravity low', 'Battery near end of life', 'Topped up distilled water, recommended replacement']],
  CHIMNEY: [['Baffle filters saturated with oil', 'Cleaning overdue', 'Deep cleaned filters and blower']],
  DISHWASHER: [['Spray arm nozzles clogged', 'Hard water scaling', 'Descaled, cleaned spray arms and filter']],
};
const READINGS: Record<string, () => Record<string, number>> = {
  AC: () => ({ gasPressurePsi: between(118, 145), currentAmps: Number((4 + rand() * 3).toFixed(1)), outletTempC: between(9, 14), supplyVoltage: between(220, 238) }),
  REFRIGERATOR: () => ({ freezerTempC: -between(14, 20), fridgeTempC: between(3, 6), currentAmps: Number((0.8 + rand()).toFixed(1)), supplyVoltage: between(220, 238) }),
  WATER_PURIFIER: () => ({ inputTds: between(380, 900), outputTds: between(35, 80), flowLph: between(10, 15) }),
  INVERTER_UPS: () => ({ batteryVoltage: Number((12 + rand()).toFixed(1)) }),
};

const RATING_COMMENTS: Record<number, string[]> = {
  5: ['Very professional, explained the problem clearly.', 'Came on time and cleaned up after work. Highly recommend!', 'Excellent service, AC is cooling like new.', 'Polite technician, fixed it in one visit.'],
  4: ['Good work, but arrived 30 minutes late.', 'Issue fixed. Pricing could be more transparent.', 'Nice service overall.'],
  3: ['Took two visits to fix. Okay experience.', 'Technician was fine but had to wait for parts.'],
  2: ['Problem came back after 3 days. Not happy.', 'Arrived very late and did not call before coming.'],
};

interface TechSpec {
  n: number;
  first: string;
  last: string;
  city: CitySpec['name'];
  skills: ServiceCategory[];
  status: TechnicianStatus;
  rating: number;
  jobs: number;
}
const TECH_SPECS: TechSpec[] = [
  { n: 1, first: 'Manjunath', last: 'Gowda', city: 'Bengaluru', skills: ['AC_REPAIR', 'AC_SERVICING', 'AC_INSTALLATION', 'REFRIGERATOR'], status: 'WORKING', rating: 4.8, jobs: 412 },
  { n: 2, first: 'Syed', last: 'Abdul Rahman', city: 'Bengaluru', skills: ['WASHING_MACHINE', 'REFRIGERATOR', 'MICROWAVE', 'DISHWASHER'], status: 'EN_ROUTE', rating: 4.6, jobs: 288 },
  { n: 3, first: 'Prakash', last: 'Shetty', city: 'Bengaluru', skills: ['TELEVISION', 'INVERTER_UPS', 'ELECTRICAL_WIRING', 'CEILING_FAN', 'MICROWAVE'], status: 'AVAILABLE', rating: 4.4, jobs: 196 },
  { n: 4, first: 'Ramesh', last: 'Kumar', city: 'Bengaluru', skills: ['WATER_PURIFIER', 'GEYSER', 'CHIMNEY', 'AIR_COOLER'], status: 'ON_BREAK', rating: 4.2, jobs: 154 },
  { n: 5, first: 'Venkatesh', last: 'Murthy', city: 'Bengaluru', skills: ['AC_REPAIR', 'AC_SERVICING', 'AIR_COOLER', 'WASHING_MACHINE'], status: 'OFFLINE', rating: 3.9, jobs: 87 },
  { n: 6, first: 'Santosh', last: 'Pawar', city: 'Mumbai', skills: ['AC_REPAIR', 'AC_SERVICING', 'AC_INSTALLATION', 'WASHING_MACHINE'], status: 'BUSY', rating: 4.7, jobs: 341 },
  { n: 7, first: 'Dinesh', last: 'Jadhav', city: 'Mumbai', skills: ['REFRIGERATOR', 'MICROWAVE', 'OVEN', 'TELEVISION', 'WATER_PURIFIER'], status: 'ONLINE', rating: 4.5, jobs: 233 },
  { n: 8, first: 'Gurpreet', last: 'Singh Bhatia', city: 'Delhi', skills: ['AC_REPAIR', 'AC_SERVICING', 'GEYSER', 'ELECTRICAL_WIRING', 'INVERTER_UPS', 'REFRIGERATOR', 'WASHING_MACHINE'], status: 'UNREACHABLE', rating: 4.1, jobs: 129 },
];

const STAFF_SPECS: { n: number; first: string; last: string; role: UserRole }[] = [
  { n: 1, first: 'Farah', last: 'Ansari', role: 'CALL_CENTER_AGENT' },
  { n: 2, first: 'Rakesh', last: 'Yadav', role: 'CALL_CENTER_AGENT' },
  { n: 3, first: 'Shalini', last: 'Menon', role: 'DISPATCHER' },
];

interface ItemSpec {
  sku: string;
  name: string;
  type?: 'SPARE_PART' | 'CONSUMABLE' | 'TOOL' | 'ACCESSORY';
  category: string;
  brand?: string;
  cats: ServiceCategory[];
  brands: string[];
  unit?: 'PIECE' | 'METER' | 'KILOGRAM' | 'SET';
  cost: number;
  sell: number;
  hsn: string;
  reorder: number;
  warrantyDays?: number;
}
const AC_CATS: ServiceCategory[] = ['AC_REPAIR', 'AC_SERVICING', 'AC_INSTALLATION'];
const ITEM_SPECS: ItemSpec[] = [
  { sku: 'ACR-GAS-R32-1KG', name: 'R32 refrigerant (1 kg can)', type: 'CONSUMABLE', category: 'Refrigerant', cats: AC_CATS, brands: [], unit: 'KILOGRAM', cost: 520, sell: 950, hsn: '29037690', reorder: 15 },
  { sku: 'ACR-GAS-R410A-1KG', name: 'R410A refrigerant (1 kg can)', type: 'CONSUMABLE', category: 'Refrigerant', cats: AC_CATS, brands: [], unit: 'KILOGRAM', cost: 610, sell: 1100, hsn: '29037690', reorder: 10 },
  { sku: 'ACR-GAS-R22-1KG', name: 'R22 refrigerant (1 kg can)', type: 'CONSUMABLE', category: 'Refrigerant', cats: AC_CATS, brands: [], unit: 'KILOGRAM', cost: 700, sell: 1250, hsn: '29037690', reorder: 6 },
  { sku: 'ACR-CAP-35MFD', name: 'Dual run capacitor 35+2.5 MFD', category: 'Capacitor', cats: AC_CATS, brands: ['Voltas', 'LG', 'Daikin', 'Samsung'], cost: 180, sell: 450, hsn: '85322500', reorder: 25, warrantyDays: 90 },
  { sku: 'ACR-CAP-45MFD', name: 'Dual run capacitor 45+5 MFD', category: 'Capacitor', cats: AC_CATS, brands: ['Voltas', 'Godrej', 'Whirlpool'], cost: 220, sell: 520, hsn: '85322500', reorder: 20, warrantyDays: 90 },
  { sku: 'ACR-FANMTR-IDU', name: 'Indoor blower fan motor 30W (universal)', category: 'Motor', cats: AC_CATS, brands: [], cost: 1150, sell: 2400, hsn: '85013119', reorder: 6, warrantyDays: 180 },
  { sku: 'ACR-FANMTR-ODU', name: 'Outdoor condenser fan motor 1/8 HP', category: 'Motor', cats: AC_CATS, brands: [], cost: 1450, sell: 2900, hsn: '85013119', reorder: 5, warrantyDays: 180 },
  { sku: 'ACR-PCB-DAIKIN-INV', name: 'Daikin inverter indoor PCB (FTKF series)', category: 'PCB', brand: 'Daikin', cats: AC_CATS, brands: ['Daikin'], cost: 3800, sell: 6200, hsn: '85371000', reorder: 2, warrantyDays: 180 },
  { sku: 'ACR-PCB-LG-DUAL', name: 'LG Dual Inverter outdoor PCB assembly', category: 'PCB', brand: 'LG', cats: AC_CATS, brands: ['LG'], cost: 5200, sell: 8400, hsn: '85371000', reorder: 2, warrantyDays: 180 },
  { sku: 'ACR-THERM-10K', name: 'Room temperature thermistor 10K', category: 'Sensor', cats: AC_CATS, brands: [], cost: 60, sell: 250, hsn: '85334030', reorder: 30 },
  { sku: 'ACR-COPPER-14', name: 'Copper pipe 1/4" insulated (per metre)', type: 'CONSUMABLE', category: 'Piping', cats: ['AC_INSTALLATION'], brands: [], unit: 'METER', cost: 260, sell: 450, hsn: '74111000', reorder: 60 },
  { sku: 'ACR-DRAIN-16MM', name: 'Drain pipe 16 mm (per metre)', type: 'CONSUMABLE', category: 'Piping', cats: AC_CATS, brands: [], unit: 'METER', cost: 18, sell: 60, hsn: '39173990', reorder: 100 },
  { sku: 'ACR-REMOTE-UNI', name: 'Universal AC remote', type: 'ACCESSORY', category: 'Accessory', cats: AC_CATS, brands: [], cost: 190, sell: 499, hsn: '85437099', reorder: 10 },
  { sku: 'FRG-THERMO-WPL', name: 'Whirlpool fridge thermostat', category: 'Thermostat', brand: 'Whirlpool', cats: ['REFRIGERATOR'], brands: ['Whirlpool'], cost: 340, sell: 750, hsn: '90321010', reorder: 6, warrantyDays: 90 },
  { sku: 'FRG-DEFROST-HTR', name: 'Defrost heater, frost-free (220V)', category: 'Heater', cats: ['REFRIGERATOR'], brands: ['LG', 'Samsung', 'Whirlpool'], cost: 420, sell: 950, hsn: '85168000', reorder: 8, warrantyDays: 90 },
  { sku: 'FRG-RELAY-OLP', name: 'Compressor relay + OLP kit', category: 'Electrical', cats: ['REFRIGERATOR'], brands: [], cost: 150, sell: 450, hsn: '85364900', reorder: 15 },
  { sku: 'FRG-GASKET-260', name: 'Door gasket 260 L (Samsung/LG)', category: 'Gasket', cats: ['REFRIGERATOR'], brands: ['Samsung', 'LG'], cost: 480, sell: 1100, hsn: '40169330', reorder: 4 },
  { sku: 'WM-DRAINPUMP-LG', name: 'LG front-load drain pump', category: 'Pump', brand: 'LG', cats: ['WASHING_MACHINE'], brands: ['LG'], cost: 950, sell: 1850, hsn: '84137010', reorder: 5, warrantyDays: 90 },
  { sku: 'WM-DOORLOCK-IFB', name: 'IFB door lock interlock', category: 'Door lock', brand: 'IFB', cats: ['WASHING_MACHINE'], brands: ['IFB'], cost: 650, sell: 1350, hsn: '85365090', reorder: 6, warrantyDays: 90 },
  { sku: 'WM-INLET-VALVE', name: 'Inlet solenoid valve (dual)', category: 'Valve', cats: ['WASHING_MACHINE'], brands: [], cost: 380, sell: 850, hsn: '84818090', reorder: 8 },
  { sku: 'WM-BEARING-6205', name: 'Drum bearing kit 6205/6206 + oil seal', category: 'Bearing', cats: ['WASHING_MACHINE'], brands: [], unit: 'SET', cost: 520, sell: 1200, hsn: '84821011', reorder: 6 },
  { sku: 'WM-BELT-1270J', name: 'Drive belt 1270 J5', category: 'Belt', cats: ['WASHING_MACHINE'], brands: [], cost: 160, sell: 420, hsn: '40103999', reorder: 10 },
  { sku: 'TV-LEDSTRIP-43', name: 'LED backlight strip set 43" (Samsung/LG)', category: 'Backlight', cats: ['TELEVISION'], brands: ['Samsung', 'LG'], unit: 'SET', cost: 1100, sell: 2600, hsn: '85299090', reorder: 4, warrantyDays: 90 },
  { sku: 'TV-PWRBRD-SONY', name: 'Sony Bravia power supply board', category: 'PCB', brand: 'Sony', cats: ['TELEVISION'], brands: ['Sony'], cost: 2400, sell: 4300, hsn: '85299090', reorder: 2, warrantyDays: 90 },
  { sku: 'RO-MEMBRANE-80G', name: 'RO membrane 80 GPD', category: 'Filter', cats: ['WATER_PURIFIER'], brands: ['Kent', 'Aquaguard'], cost: 650, sell: 1650, hsn: '84212190', reorder: 12, warrantyDays: 180 },
  { sku: 'RO-SEDIMENT-10', name: 'Sediment filter cartridge 10"', type: 'CONSUMABLE', category: 'Filter', cats: ['WATER_PURIFIER'], brands: [], cost: 70, sell: 250, hsn: '84212190', reorder: 40 },
  { sku: 'RO-CARBON-PRE', name: 'Pre-carbon filter cartridge', type: 'CONSUMABLE', category: 'Filter', cats: ['WATER_PURIFIER'], brands: [], cost: 110, sell: 350, hsn: '84212190', reorder: 30 },
  { sku: 'RO-PUMP-24V', name: 'RO booster pump 24V', category: 'Pump', cats: ['WATER_PURIFIER'], brands: ['Kent', 'Aquaguard'], cost: 1300, sell: 2500, hsn: '84137010', reorder: 4, warrantyDays: 180 },
  { sku: 'MW-MAGNETRON-2M214', name: 'Magnetron 2M214 (universal)', category: 'Magnetron', cats: ['MICROWAVE'], brands: ['LG', 'Samsung', 'IFB'], cost: 1250, sell: 2400, hsn: '85407100', reorder: 3, warrantyDays: 90 },
  { sku: 'GEY-ELEMENT-2KW', name: 'Geyser heating element 2 kW', category: 'Heater', cats: ['GEYSER'], brands: ['Havells'], cost: 340, sell: 790, hsn: '85168000', reorder: 8, warrantyDays: 90 },
  { sku: 'UPS-BATT-150AH', name: 'Luminous 150Ah tall tubular battery', category: 'Battery', brand: 'Luminous', cats: ['INVERTER_UPS'], brands: ['Luminous'], cost: 11800, sell: 15500, hsn: '85072000', reorder: 2, warrantyDays: 1095 },
  { sku: 'TL-MANIFOLD-DIGI', name: 'Digital manifold gauge set (R32/R410A)', type: 'TOOL', category: 'Tool', cats: AC_CATS, brands: [], cost: 8900, sell: 0, hsn: '90262000', reorder: 1 },
];

// ============================================================================
// Reset
// ============================================================================

const demoId = { startsWith: P };

async function reset(): Promise<void> {
  console.info('Removing demo rows…');
  const cust = { customerId: demoId };
  const book = { bookingId: demoId };
  const steps: [string, () => Promise<{ count: number }>][] = [
    ['Notification', () => prisma.notification.deleteMany({ where: { OR: [{ id: demoId }, { userId: demoId }] } })],
    ['TechnicianLocation', () => prisma.technicianLocation.deleteMany({ where: { OR: [{ id: demoId }, { technicianId: demoId }] } })],
    ['TechnicianAvailability', () => prisma.technicianAvailability.deleteMany({ where: { OR: [{ id: demoId }, { technicianId: demoId }] } })],
    ['TechnicianShift', () => prisma.technicianShift.deleteMany({ where: { OR: [{ id: demoId }, { technicianId: demoId }] } })],
    ['DispatchEvent', () => prisma.dispatchEvent.deleteMany({ where: { OR: [{ id: demoId }, { technicianId: demoId }] } })],
    ['DispatchAssignment', () => prisma.dispatchAssignment.deleteMany({ where: { OR: [{ id: demoId }, { technicianId: demoId }, book] } })],
    ['Task', () => prisma.task.deleteMany({ where: { id: demoId } })],
    ['CustomFieldDefinition', () => prisma.customFieldDefinition.deleteMany({ where: { id: demoId } })],
    ['Opportunity', () => prisma.opportunity.deleteMany({ where: { OR: [{ id: demoId }, cust, { accountId: demoId }, { leadId: demoId }] } })],
    ['LoyaltyLedgerEntry', () => prisma.loyaltyLedgerEntry.deleteMany({ where: { OR: [{ id: demoId }, cust] } })],
    ['Referral', () => prisma.referral.deleteMany({ where: { OR: [{ id: demoId }, { referrerCustomerId: demoId }, { referredCustomerId: demoId }] } })],
    ['ReferralCode', () => prisma.referralCode.deleteMany({ where: { OR: [{ id: demoId }, cust] } })],
    ['CouponRedemption', () => prisma.couponRedemption.deleteMany({ where: { OR: [{ id: demoId }, cust, { couponId: demoId }] } })],
    ['Campaign', () => prisma.campaign.deleteMany({ where: { OR: [{ id: demoId }, { segmentId: demoId }, { couponId: demoId }] } })],
    ['CustomerSegment', () => prisma.customerSegment.deleteMany({ where: { id: demoId } })],
    ['Coupon', () => prisma.coupon.deleteMany({ where: { id: demoId } })],
    ['InventoryAlert', () => prisma.inventoryAlert.deleteMany({ where: { OR: [{ id: demoId }, { itemId: demoId }] } })],
    ['TechnicianInventory', () => prisma.technicianInventory.deleteMany({ where: { OR: [{ id: demoId }, { itemId: demoId }, { technicianId: demoId }] } })],
    ['StockTransferItem', () => prisma.stockTransferItem.deleteMany({ where: { OR: [{ id: demoId }, { transferId: demoId }, { itemId: demoId }] } })],
    ['StockTransfer', () => prisma.stockTransfer.deleteMany({ where: { OR: [{ id: demoId }, { sourceWarehouseId: demoId }, { destWarehouseId: demoId }] } })],
    ['GoodsReceiptItem', () => prisma.goodsReceiptItem.deleteMany({ where: { OR: [{ id: demoId }, { goodsReceiptId: demoId }, { itemId: demoId }] } })],
    ['GoodsReceipt', () => prisma.goodsReceipt.deleteMany({ where: { OR: [{ id: demoId }, { purchaseOrderId: demoId }, { warehouseId: demoId }] } })],
    ['PurchaseOrderItem', () => prisma.purchaseOrderItem.deleteMany({ where: { OR: [{ id: demoId }, { purchaseOrderId: demoId }, { itemId: demoId }] } })],
    ['PurchaseOrder', () => prisma.purchaseOrder.deleteMany({ where: { OR: [{ id: demoId }, { vendorId: demoId }, { warehouseId: demoId }] } })],
    ['InventoryLedger', () => prisma.inventoryLedger.deleteMany({ where: { OR: [{ id: demoId }, { itemId: demoId }, { warehouseId: demoId }] } })],
    ['WarehouseStock', () => prisma.warehouseStock.deleteMany({ where: { OR: [{ id: demoId }, { itemId: demoId }, { warehouseId: demoId }] } })],
    ['InventoryItem', () => prisma.inventoryItem.deleteMany({ where: { id: demoId } })],
    ['Vendor', () => prisma.vendor.deleteMany({ where: { id: demoId } })],
    ['WarehouseZone', () => prisma.warehouseZone.deleteMany({ where: { OR: [{ id: demoId }, { warehouseId: demoId }] } })],
    ['WarrantyClaim', () => prisma.warrantyClaim.deleteMany({ where: { OR: [{ id: demoId }, cust] } })],
    ['CannedResponse', () => prisma.cannedResponse.deleteMany({ where: { id: demoId } })],
    ['KnowledgeBaseArticle', () => prisma.knowledgeBaseArticle.deleteMany({ where: { OR: [{ id: demoId }, { categoryId: demoId }] } })],
    ['KnowledgeBaseCategory(child)', () => prisma.knowledgeBaseCategory.deleteMany({ where: { id: demoId, parentId: { not: null } } })],
    ['KnowledgeBaseCategory', () => prisma.knowledgeBaseCategory.deleteMany({ where: { id: demoId } })],
    ['CallLog', () => prisma.callLog.deleteMany({ where: { OR: [{ id: demoId }, cust, book, { ticketId: demoId }] } })],
    ['TicketMessage', () => prisma.ticketMessage.deleteMany({ where: { OR: [{ id: demoId }, { ticketId: demoId }] } })],
    ['ConversationMessage', () => prisma.conversationMessage.deleteMany({ where: { OR: [{ id: demoId }, { conversationId: demoId }] } })],
    ['ConversationParticipant', () => prisma.conversationParticipant.deleteMany({ where: { OR: [{ id: demoId }, { conversationId: demoId }] } })],
    ['Conversation', () => prisma.conversation.deleteMany({ where: { OR: [{ id: demoId }, cust, { ticketId: demoId }] } })],
    ['TicketActivity', () => prisma.ticketActivity.deleteMany({ where: { OR: [{ id: demoId }, { ticketId: demoId }] } })],
    ['TicketAttachment', () => prisma.ticketAttachment.deleteMany({ where: { OR: [{ id: demoId }, { ticketId: demoId }] } })],
    ['SupportTicket', () => prisma.supportTicket.deleteMany({ where: { OR: [{ id: demoId }, cust, book] } })],
    ['SLAProfile', () => prisma.sLAProfile.deleteMany({ where: { id: demoId } })],
    ['TechnicianCommission', () => prisma.technicianCommission.deleteMany({ where: { OR: [{ id: demoId }, book, { technicianId: demoId }] } })],
    ['TechnicianPayout', () => prisma.technicianPayout.deleteMany({ where: { OR: [{ id: demoId }, { technicianId: demoId }] } })],
    ['TechnicianCommissionRule', () => prisma.technicianCommissionRule.deleteMany({ where: { OR: [{ id: demoId }, { technicianId: demoId }] } })],
    ['AMCVisit', () => prisma.aMCVisit.deleteMany({ where: { OR: [{ id: demoId }, { subscriptionId: demoId }, book] } })],
    ['CustomerLedgerEntry', () => prisma.customerLedgerEntry.deleteMany({ where: { OR: [{ id: demoId }, cust] } })],
    ['Payment', () => prisma.payment.deleteMany({ where: { OR: [{ id: demoId }, { invoiceId: demoId }, { invoice: cust }] } })],
    ['PaymentTransaction', () => prisma.paymentTransaction.deleteMany({ where: { OR: [{ id: demoId }, cust] } })],
    ['InvoiceLineItem', () => prisma.invoiceLineItem.deleteMany({ where: { OR: [{ id: demoId }, { invoiceId: demoId }] } })],
    ['Invoice', () => prisma.invoice.deleteMany({ where: { OR: [{ id: demoId }, cust] } })],
    ['QuotationLineItem', () => prisma.quotationLineItem.deleteMany({ where: { OR: [{ id: demoId }, { quotationId: demoId }] } })],
    ['Quotation', () => prisma.quotation.deleteMany({ where: { OR: [{ id: demoId }, cust] } })],
    ['AMCSubscription', () => prisma.aMCSubscription.deleteMany({ where: { OR: [{ id: demoId }, cust] } })],
    ['BookingRating', () => prisma.bookingRating.deleteMany({ where: { OR: [{ id: demoId }, cust, book] } })],
    ['WorkshopJob', () => prisma.workshopJob.deleteMany({ where: { OR: [{ id: demoId }, book] } })],
    ['JobCard', () => prisma.jobCard.deleteMany({ where: { OR: [{ id: demoId }, book] } })],
    ['BookingNote', () => prisma.bookingNote.deleteMany({ where: { OR: [{ id: demoId }, book] } })],
    ['BookingAttachment', () => prisma.bookingAttachment.deleteMany({ where: { OR: [{ id: demoId }, book] } })],
    ['BookingActivity', () => prisma.bookingActivity.deleteMany({ where: { OR: [{ id: demoId }, book] } })],
    ['Booking(revisits)', () => prisma.booking.deleteMany({ where: { OR: [{ id: demoId }, cust], parentBookingId: { not: null } } })],
    ['Booking', () => prisma.booking.deleteMany({ where: { OR: [{ id: demoId }, cust] } })],
    ['LeadActivity', () => prisma.leadActivity.deleteMany({ where: { OR: [{ id: demoId }, { leadId: demoId }] } })],
    ['LeadNote', () => prisma.leadNote.deleteMany({ where: { OR: [{ id: demoId }, { leadId: demoId }] } })],
    ['Lead', () => prisma.lead.deleteMany({ where: { id: demoId } })],
    ['CustomerAppliance', () => prisma.customerAppliance.deleteMany({ where: { OR: [{ id: demoId }, cust] } })],
    ['Customer(unlink default address)', () => prisma.customer.updateMany({ where: { id: demoId }, data: { defaultAddressId: null } })],
    ['Address', () => prisma.address.deleteMany({ where: { OR: [{ id: demoId }, cust] } })],
    ['Customer', () => prisma.customer.deleteMany({ where: { id: demoId } })],
    ['Technician', () => prisma.technician.deleteMany({ where: { id: demoId } })],
    ['Warehouse', () => prisma.warehouse.deleteMany({ where: { id: demoId } })],
    ['Account', () => prisma.account.deleteMany({ where: { id: demoId } })],
    ['UserRoleAssignment', () => prisma.userRoleAssignment.deleteMany({ where: { userId: demoId } })],
    ['User', () => prisma.user.deleteMany({ where: { id: demoId } })],
  ];
  let total = 0;
  for (const [name, run] of steps) {
    const { count } = await run();
    total += count;
    if (count > 0) console.info(`  - ${name}: ${count}`);
  }
  console.info(`Removed ${total} demo rows.`);
}

// ============================================================================
// Seed
// ============================================================================

interface Ctx {
  tenantId: string;
  cityIds: Record<CitySpec['name'], string>;
  roleIds: Partial<Record<UserRole, string>>;
  adminId: string;
  dispatcherId: string;
  baseTech: { id: string; userId: string; fullName: string; cityId: string; skills: ServiceCategory[] };
}

async function loadContext(): Promise<Ctx> {
  const tenant = must(await prisma.tenant.findUnique({ where: { slug: 'default' } }), 'tenant "default"');
  const cities = await prisma.city.findMany({ where: { tenantId: tenant.id } });
  const cityIds = {} as Record<CitySpec['name'], string>;
  for (const c of CITY_SPECS) cityIds[c.name] = must(cities.find((x) => x.name === c.name), `city ${c.name}`).id;
  const roles = await prisma.role.findMany({ where: { tenantId: tenant.id } });
  const roleIds: Partial<Record<UserRole, string>> = {};
  for (const r of roles) roleIds[r.key] = r.id;
  const admin = must(await prisma.user.findUnique({ where: { phone: '+919999999999' } }), 'admin user');
  const dispatcher = must(await prisma.user.findUnique({ where: { phone: '+919876543210' } }), 'dispatcher user');
  const tech = must(await prisma.technician.findUnique({ where: { employeeCode: 'SEED-TECH-01' } }), 'base technician');
  return {
    tenantId: tenant.id,
    cityIds,
    roleIds,
    adminId: admin.id,
    dispatcherId: dispatcher.id,
    baseTech: { id: tech.id, userId: tech.userId, fullName: tech.fullName, cityId: tech.cityId, skills: tech.skills },
  };
}

interface TechRef {
  id: string;
  userId: string;
  name: string;
  city: CitySpec['name'];
  skills: ServiceCategory[];
  isDemo: boolean;
}

interface LineCalc {
  description: string;
  quantity: number;
  unitPriceMinor: number;
  taxRateBps: number;
  hsnSacCode: string;
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
}
function line(description: string, quantity: number, unitPriceMinor: number, hsnSacCode: string, taxRateBps = 1800): LineCalc {
  const subtotalMinor = quantity * unitPriceMinor;
  const taxMinor = Math.round((subtotalMinor * taxRateBps) / 10000);
  return { description, quantity, unitPriceMinor, taxRateBps, hsnSacCode, subtotalMinor, taxMinor, totalMinor: subtotalMinor + taxMinor };
}

async function seed(): Promise<void> {
  const ctx = await loadContext();
  const T = ctx.tenantId;
  const staffIds = [ctx.adminId, ctx.dispatcherId];
  console.info('Seeding demo data…');

  const catalog = await prisma.serviceCatalogItem.findMany({ where: { tenantId: T, isActive: true, deletedAt: null } });
  const faultCodes = await prisma.faultCode.findMany({ where: { tenantId: T, isActive: true, deletedAt: null } });
  const checklistTemplates = await prisma.checklistTemplate.findMany({ where: { tenantId: T, isActive: true, deletedAt: null } });
  const plans = await prisma.aMCPlan.findMany({ where: { tenantId: T, deletedAt: null } });
  const plan = (slug: string) => must(plans.find((p) => p.slug === slug), `AMC plan ${slug}`);
  if (catalog.length === 0) must(null, 'service catalog');

  // --------------------------------------------------------------------------
  // Users: staff, technicians, customers
  // --------------------------------------------------------------------------
  const users: Prisma.UserCreateManyInput[] = [];
  const roleLinks: Prisma.UserRoleAssignmentCreateManyInput[] = [];
  const roleId = (k: UserRole) => must(ctx.roleIds[k], `role ${k}`);

  for (const s of STAFF_SPECS) {
    const id = did('user', `s${String(s.n).padStart(2, '0')}`);
    users.push({
      id,
      tenantId: T,
      phone: demoPhone(900 + s.n),
      email: `${s.first}.${s.last}@acplatform.example`.toLowerCase(),
      firstName: s.first,
      lastName: s.last,
      phoneVerified: true,
      status: 'ACTIVE',
      authProvider: 'OTP',
      lastLoginAt: ago(between(1, 30) * HOUR),
      createdAt: ago(between(60, 120) * DAY),
      createdBy: ctx.adminId,
    });
    roleLinks.push({ userId: id, roleId: roleId(s.role), assignedBy: ctx.adminId });
    staffIds.push(id);
  }
  const agentIds = [did('user', 's01'), did('user', 's02')];

  const techs: TechRef[] = [
    {
      id: ctx.baseTech.id,
      userId: ctx.baseTech.userId,
      name: ctx.baseTech.fullName,
      city: 'Bengaluru',
      skills: ctx.baseTech.skills,
      isDemo: false,
    },
  ];
  const technicians: Prisma.TechnicianCreateManyInput[] = [];
  const commissionRules: Prisma.TechnicianCommissionRuleCreateManyInput[] = [];
  for (const s of TECH_SPECS) {
    const userId = did('user', `t${String(s.n).padStart(2, '0')}`);
    const id = did('tech', s.n);
    const city = must(CITY_SPECS.find((c) => c.name === s.city), s.city);
    const online = !['OFFLINE', 'UNREACHABLE'].includes(s.status);
    const lastAt = online ? ago(between(1, 6) * MIN) : ago(between(5, 30) * HOUR);
    users.push({
      id: userId,
      tenantId: T,
      phone: demoPhone(100 + s.n),
      email: s.n % 3 === 0 ? null : `${s.first}.${s.last.split(' ')[0]}@acplatform.example`.toLowerCase(),
      firstName: s.first,
      lastName: s.last,
      phoneVerified: true,
      status: 'ACTIVE',
      authProvider: 'OTP',
      lastLoginAt: lastAt,
      createdAt: ago(between(90, 400) * DAY),
      createdBy: ctx.adminId,
    });
    roleLinks.push({ userId, roleId: roleId('TECHNICIAN'), assignedBy: ctx.adminId });
    technicians.push({
      id,
      tenantId: T,
      userId,
      cityId: ctx.cityIds[s.city],
      employeeCode: `DEMO-TECH-${String(s.n).padStart(2, '0')}`,
      fullName: `${s.first} ${s.last}`,
      phone: demoPhone(100 + s.n),
      skills: s.skills,
      rating: s.rating,
      totalJobs: s.jobs,
      acceptanceRate: Number((0.82 + rand() * 0.17).toFixed(2)),
      completionRate: Number((0.88 + rand() * 0.11).toFixed(2)),
      dailyCapacity: pick([6, 7, 8, 8, 10]),
      status: s.status,
      lastSeenAt: lastAt,
      onlineSince: online ? ago(between(60, 300) * MIN) : null,
      lastLatitude: city.lat + (rand() - 0.5) * 0.12,
      lastLongitude: city.lng + (rand() - 0.5) * 0.12,
      lastHeading: between(0, 359),
      lastSpeedMps: s.status === 'EN_ROUTE' ? Number((6 + rand() * 6).toFixed(1)) : 0,
      lastAccuracyM: between(5, 25),
      lastBatteryPct: between(18, 96),
      lastLocationAt: lastAt,
      workingHours: json({
        mon: [['09:00', '19:00']],
        tue: [['09:00', '19:00']],
        wed: [['09:00', '19:00']],
        thu: [['09:00', '19:00']],
        fri: [['09:00', '19:00']],
        sat: [['09:00', '17:00']],
        ...(s.n % 2 === 0 ? { sun: [['10:00', '14:00']] } : {}),
      }),
      documents: json([
        { type: 'AADHAAR', label: 'Aadhaar card', verified: true, url: img('Aadhaar') },
        { type: 'DRIVING_LICENSE', label: 'Driving licence', verified: s.n !== 5, url: img('DL') },
      ]),
      createdAt: ago(between(90, 400) * DAY),
    });
    commissionRules.push({
      id: did('crule', s.n),
      tenantId: T,
      technicianId: id,
      type: s.n % 3 === 0 ? 'PER_JOB' : 'PERCENTAGE',
      valueMinor: s.n % 3 === 0 ? inr(250) : pick([3000, 3500, 4000]),
      bonusMinor: inr(pick([0, 50, 100])),
      penaltyPerLateMinuteMinor: inr(2),
      minPayoutMinor: inr(500),
      payoutCycle: s.n % 2 === 0 ? 'WEEKLY' : 'BIWEEKLY',
    });
    techs.push({ id, userId, name: `${s.first} ${s.last}`, city: s.city, skills: s.skills, isDemo: true });
  }

  // --------------------------------------------------------------------------
  // B2B accounts
  // --------------------------------------------------------------------------
  const accountSpecs = [
    { name: 'Lakeshore Gardens Residents Welfare Association', type: 'RESIDENTIAL_SOCIETY' as const, city: 'Bengaluru' as const, gstin: '29AAATL4821K1Z3', tags: ['society', 'amc'] },
    { name: 'Vertex Tech Park Facilities Pvt Ltd', type: 'OFFICE' as const, city: 'Bengaluru' as const, gstin: '29AACCV7310M1ZQ', tags: ['corporate', 'priority'] },
    { name: 'Hotel Sea Breeze Residency', type: 'HOSPITALITY' as const, city: 'Mumbai' as const, gstin: '27AAFHS2290P1Z8', tags: ['hotel'] },
    { name: 'Greenfield International School', type: 'INSTITUTION' as const, city: 'Delhi' as const, gstin: null, tags: ['school'] },
    { name: 'Sri Balaji Builders & Developers', type: 'BUILDER' as const, city: 'Bengaluru' as const, gstin: '29AAKFS9054R1ZB', tags: ['builder', 'installation'] },
  ];
  const accounts: Prisma.AccountCreateManyInput[] = accountSpecs.map((a, i) => ({
    id: did('acct', i + 1),
    tenantId: T,
    name: a.name,
    type: a.type,
    gstin: a.gstin,
    billingEmail: i === 3 ? null : `accounts@${a.name.split(' ')[0]?.toLowerCase() ?? 'acct'}.example`,
    phone: demoPhone(800 + i + 1),
    ownerUserId: at(staffIds, i),
    addressLine: [
      'Lakeshore Gardens, Sarjapur Road, Bengaluru 560035',
      'Vertex Tech Park, Tower 2, Outer Ring Road, Bellandur, Bengaluru 560103',
      '22 Juhu Tara Road, Juhu, Mumbai 400049',
      'Plot 7, Sector 22, Dwarka, New Delhi 110077',
      '3rd Floor, Balaji Arcade, Hosur Road, Bengaluru 560068',
    ][i],
    cityId: ctx.cityIds[a.city],
    notes: i === 1 ? 'Facility manager prefers weekend visits. PO required before every job above ₹25,000.' : null,
    tags: a.tags,
    createdAt: ago(between(50, 200) * DAY),
    createdBy: ctx.adminId,
  }));
  const accountForCustomer: Record<number, string> = { 2: did('acct', 1), 5: did('acct', 1), 9: did('acct', 1), 12: did('acct', 2), 22: did('acct', 5), 27: did('acct', 3), 39: did('acct', 4) };

  // --------------------------------------------------------------------------
  // Customers + addresses + appliances
  // --------------------------------------------------------------------------
  interface CustRef {
    i: number;
    id: string;
    userId: string;
    name: string;
    phone: string;
    email: string | null;
    city: CitySpec;
    addressId: string;
    address: { line1: string; line2: string | null; landmark: string | null; city: string; state: string; pincode: string; country: string };
    lat: number;
    lng: number;
    appliances: { id: string; category: ServiceCategory; brand: string; model: string; capacity: string; warrantyUntil: Date | null }[];
    createdAt: Date;
  }
  const customers: CustRef[] = [];
  const customerRows: Prisma.CustomerCreateManyInput[] = [];
  const addressRows: Prisma.AddressCreateManyInput[] = [];
  const applianceRows: Prisma.CustomerApplianceCreateManyInput[] = [];
  const TAGS = ['vip', 'repeat', 'price-sensitive', 'whatsapp-preferred', 'senior-citizen', 'new', 'corporate', 'referral'];
  const LANGS = ['en', 'en', 'en', 'hi', 'kn', 'mr', 'ta', 'te'];
  let applianceSeq = 0;

  CUSTOMER_NAMES.forEach((name, i) => {
    const n = i + 1;
    const city = at(CITY_SPECS, cityIndexForCustomer(i));
    const loc = at(city.localities, i * 7 + 3);
    const id = did('cust', n);
    const userId = did('user', `c${String(n).padStart(2, '0')}`);
    const phone = demoPhone(1000 + n);
    const [first = name, ...rest] = name.split(' ');
    const last = rest.join(' ');
    const email = n % 7 === 0 || n === 41 ? null : `${first}.${rest[rest.length - 1] ?? 'home'}${n}@example.com`.toLowerCase();
    const createdAt = ago(between(46, 420) * DAY);
    const isLong = n === 21 || n === 41;
    const flat = pick(['Flat', 'Flat', 'Apt', 'House No.', '#']);
    const line1 = isLong
      ? 'Flat 1204, Tower B, Wing 3, Sobha Dream Acres Phase 2 — Lake View Residences'
      : `${flat} ${between(1, 18)}${String(between(1, 12)).padStart(2, '0')}, ${pick(city.buildings)}`;
    const line2 = isLong
      ? `Gunjur Village, Varthur Hobli, Off Whitefield–Sarjapur Main Road, ${loc.name}`
      : `${pick(city.streets)}, ${loc.name}`;
    const landmark = isLong
      ? 'Opposite the new BBMP park, next to the blue water tank, enter via Gate 4 (service entrance)'
      : chance(0.6)
        ? pick(city.landmarks)
        : null;
    const lat = loc.lat + (rand() - 0.5) * 0.01;
    const lng = loc.lng + (rand() - 0.5) * 0.01;
    const addressId = did('addr', n);
    const address = { line1, line2, landmark, city: city.name, state: city.state, pincode: loc.pincode, country: 'IN' };
    users.push({
      id: userId,
      tenantId: T,
      phone,
      email,
      firstName: first,
      lastName: last || null,
      phoneVerified: true,
      emailVerified: !!email && chance(0.5),
      status: 'ACTIVE',
      authProvider: 'OTP',
      lastLoginAt: chance(0.6) ? ago(between(1, 40) * DAY) : null,
      createdAt,
    });
    roleLinks.push({ userId, roleId: roleId('CUSTOMER') });
    const tags = new Set<string>();
    if (n % 4 === 0) tags.add(at(TAGS, n));
    if (n % 5 === 0) tags.add(at(TAGS, n + 3));
    if (accountForCustomer[i]) tags.add('corporate');
    customerRows.push({
      id,
      tenantId: T,
      userId,
      cityId: ctx.cityIds[city.name],
      fullName: name,
      email,
      phone,
      accountId: accountForCustomer[i] ?? null,
      tags: [...tags],
      preferredLanguage: at(LANGS, n * 3),
      preferences: json({ contactChannel: pick(['WHATSAPP', 'SMS', 'CALL']), demo: true }),
      customFields: json(
        n % 3 === 0 ? { preferred_contact_time: pick(['Morning (9–12)', 'Afternoon (12–4)', 'Evening (4–8)']) } : {},
      ),
      createdAt,
    });
    addressRows.push({ id: addressId, customerId: id, label: 'Home', ...address, latitude: lat, longitude: lng, createdAt });
    if (n % 6 === 0) {
      const loc2 = at(city.localities, i + 5);
      addressRows.push({
        id: did('addr', 100 + n),
        customerId: id,
        label: pick(['Office', "Parents' home", 'Rental flat']),
        line1: `${between(2, 9)}${String(between(1, 20)).padStart(2, '0')}, ${pick(city.buildings)}`,
        line2: `${pick(city.streets)}, ${loc2.name}`,
        landmark: null,
        city: city.name,
        state: city.state,
        pincode: loc2.pincode,
        latitude: loc2.lat,
        longitude: loc2.lng,
        createdAt: plus(createdAt, 20 * DAY),
      });
    }

    // Appliances (1–3, distinct categories). Every 4th customer is
    // guaranteed a workshop-friendly appliance (TV / microwave / WM).
    const count = n % 5 === 0 ? 3 : n % 2 === 0 ? 2 : between(1, 2);
    const cats = new Set<ServiceCategory>();
    if (n % 4 === 1) cats.add(at(['TELEVISION', 'MICROWAVE', 'WASHING_MACHINE'] as const, n));
    while (cats.size < count) cats.add(weighted(APPLIANCE_WEIGHTS));
    const appliances: CustRef['appliances'] = [];
    for (const category of cats) {
      applianceSeq += 1;
      const [brand, model, capacity] = pick(must(APPLIANCE_MODELS[category], `models for ${category}`));
      const purchase = ago(between(120, 2000) * DAY);
      let warrantyUntil: Date = plus(purchase, 365 * DAY);
      if (applianceSeq % 9 === 0) warrantyUntil = plus(NOW, between(5, 25) * DAY); // expiring soon
      else if (applianceSeq % 7 === 0) warrantyUntil = plus(NOW, between(60, 300) * DAY); // valid
      const extended = applianceSeq % 6 === 0 ? plus(warrantyUntil, 730 * DAY) : null;
      const aid = did('appl', applianceSeq);
      applianceRows.push({
        id: aid,
        tenantId: T,
        customerId: id,
        addressId,
        category,
        brand,
        modelNumber: applianceSeq % 13 === 0 ? null : model,
        serialNumber: applianceSeq % 11 === 0 ? null : `${brand.slice(0, 2).toUpperCase()}${alnum(10)}`,
        capacity,
        installedLocation: category === 'AC_REPAIR' || category === 'TELEVISION' ? pick(ROOMS) : category === 'WASHING_MACHINE' ? 'Utility area' : 'Kitchen',
        purchaseDate: purchase,
        installDate: plus(purchase, between(1, 6) * DAY),
        manufacturerWarrantyUntil: warrantyUntil,
        extendedWarrantyUntil: extended,
        warrantyProvider: extended ? pick(['OneAssist', 'Brand extended warranty', 'Croma Zip Care']) : null,
        notes: applianceSeq % 10 === 0 ? 'Outdoor unit on balcony grill, ladder required.' : null,
        lastServicedAt: chance(0.5) ? ago(between(20, 300) * DAY) : null,
        metadata: json({ demo: true }),
        createdAt: plus(createdAt, DAY),
        createdBy: ctx.adminId,
      });
      appliances.push({ id: aid, category, brand, model, capacity, warrantyUntil: extended ?? warrantyUntil });
    }
    customers.push({ i, id, userId, name, phone, email, city, addressId, address, lat, lng, appliances, createdAt });
  });

  // --------------------------------------------------------------------------
  // Bookings plan
  // --------------------------------------------------------------------------
  const statusPool: BookingStatus[] = [
    ...Array<BookingStatus>(27).fill('COMPLETED'),
    ...Array<BookingStatus>(5).fill('CANCELLED'),
    ...Array<BookingStatus>(3).fill('NO_SHOW'),
    ...Array<BookingStatus>(4).fill('WAITING_PARTS'),
    ...Array<BookingStatus>(4).fill('IN_PROGRESS'),
    ...Array<BookingStatus>(3).fill('TECHNICIAN_EN_ROUTE'),
    ...Array<BookingStatus>(6).fill('ASSIGNED'),
    ...Array<BookingStatus>(5).fill('CONFIRMED'),
    ...Array<BookingStatus>(6).fill('PENDING'),
    ...Array<BookingStatus>(2).fill('RESCHEDULED'),
    ...Array<BookingStatus>(2).fill('DRAFT'),
  ];
  // Workshop overrides: [status, occurrence index, mode, workshop status]
  const workshopPlan: [BookingStatus, number, ServiceMode, WorkshopJobStatus][] = [
    ['COMPLETED', 3, 'PICKUP_DROP', 'DELIVERED'],
    ['COMPLETED', 9, 'CARRY_IN', 'DELIVERED'],
    ['IN_PROGRESS', 0, 'PICKUP_DROP', 'REPAIRING'],
    ['IN_PROGRESS', 1, 'CARRY_IN', 'DIAGNOSING'],
    ['IN_PROGRESS', 2, 'PICKUP_DROP', 'READY_FOR_DELIVERY'],
    ['WAITING_PARTS', 0, 'PICKUP_DROP', 'AWAITING_APPROVAL'],
    ['ASSIGNED', 0, 'PICKUP_DROP', 'PICKUP_SCHEDULED'],
    ['TECHNICIAN_EN_ROUTE', 0, 'PICKUP_DROP', 'OUT_FOR_DELIVERY'],
    ['CONFIRMED', 0, 'PICKUP_DROP', 'PICKUP_SCHEDULED'],
  ];
  const WORKSHOP_CATS: ServiceCategory[] = ['TELEVISION', 'MICROWAVE', 'WASHING_MACHINE'];

  interface BookingRef {
    n: number;
    id: string;
    code: string;
    status: BookingStatus;
    cust: CustRef;
    appliance: CustRef['appliances'][number];
    category: ServiceCategory;
    catalogItem: (typeof catalog)[number];
    tech: TechRef | null;
    scheduledAt: Date;
    createdAt: Date;
    assignedAt: Date | null;
    enRouteAt: Date | null;
    arrivedAt: Date | null;
    startedAt: Date | null;
    waitingPartsAt: Date | null;
    completedAt: Date | null;
    cancelledAt: Date | null;
    mode: ServiceMode;
    ws: WorkshopJobStatus | null;
    parent: BookingRef | null;
    priority: BookingPriority;
    issue: string;
    estimatedAmountMinor: number;
    leadId: string | null;
    createdBy: string;
  }
  const bookings: BookingRef[] = [];
  const occurrences: Partial<Record<BookingStatus, number>> = {};
  const completedTotal = statusPool.filter((s) => s === 'COMPLETED').length;

  function techFor(city: CitySpec['name'], category: ServiceCategory): TechRef {
    const inCity = techs.filter((t) => t.city === city);
    const skilled = inCity.filter((t) => t.skills.some((s) => fam(s) === fam(category)));
    return pick(skilled.length > 0 ? skilled : inCity);
  }
  function bookingCategory(applianceCat: ServiceCategory): ServiceCategory {
    if (applianceCat !== 'AC_REPAIR') return applianceCat;
    return weighted<ServiceCategory>([
      ['AC_REPAIR', 55],
      ['AC_SERVICING', 35],
      ['AC_INSTALLATION', 10],
    ]);
  }
  function catalogFor(category: ServiceCategory) {
    const items = catalog.filter((c) => c.category === category);
    const paid = items.filter((c) => c.basePriceMinor > 0);
    if (paid.length > 0 && chance(0.75)) return pick(paid);
    return items.length > 0 ? pick(items) : must(catalog.find((c) => c.code === 'OTHER-VISIT') ?? catalog[0], 'catalog item');
  }

  let custCursor = 0;
  const shuffled = [...statusPool].sort(() => rand() - 0.5);
  shuffled.forEach((status, idx) => {
    const occ = occurrences[status] ?? 0;
    occurrences[status] = occ + 1;
    const wsPlan = workshopPlan.find(([s, o]) => s === status && o === occ);
    const n = idx + 1;

    // Customer + appliance
    let cust = at(customers, custCursor);
    let appliance = at(cust.appliances, n);
    if (wsPlan) {
      for (let k = 0; k < customers.length; k++) {
        const c = at(customers, custCursor + k);
        const a = c.appliances.find((x) => WORKSHOP_CATS.includes(x.category));
        if (a) {
          cust = c;
          appliance = a;
          break;
        }
      }
    }
    custCursor += n % 3 === 0 ? 2 : 1;

    const category = wsPlan ? appliance.category : bookingCategory(appliance.category);
    const catalogItem = catalogFor(category);

    // Schedule
    let scheduledAt: Date;
    const hour = pick([9, 11, 13, 15, 17]);
    switch (status) {
      case 'COMPLETED': {
        const k = occ; // spread completed jobs over the last 45 days
        const dayOffset = k >= completedTotal - 2 ? 0 : -1 - Math.floor(((completedTotal - 3 - k) * 43) / (completedTotal - 2));
        scheduledAt = dayOffset === 0 ? istAt(0, 7 + occ % 2, 0) : istAt(dayOffset, hour);
        if (scheduledAt > ago(4 * HOUR)) scheduledAt = ago(between(4, 6) * HOUR);
        break;
      }
      case 'CANCELLED':
        scheduledAt = istAt(between(-30, 3), hour);
        break;
      case 'NO_SHOW':
        scheduledAt = istAt(between(-20, -1), hour);
        break;
      case 'WAITING_PARTS':
        scheduledAt = istAt(between(-6, -1), hour);
        break;
      case 'IN_PROGRESS':
        scheduledAt = ago(between(40, 120) * MIN);
        break;
      case 'TECHNICIAN_EN_ROUTE':
        scheduledAt = plus(NOW, between(10, 40) * MIN);
        break;
      case 'ASSIGNED':
        scheduledAt = occ < 2 ? plus(NOW, between(2, 5) * HOUR) : istAt(between(1, 2), hour);
        break;
      case 'CONFIRMED':
        scheduledAt = istAt(between(1, 7), hour);
        break;
      case 'PENDING':
        scheduledAt = occ === 0 ? ago(between(60, 150) * MIN) : istAt(between(0, 5), hour);
        if (occ !== 0 && scheduledAt < NOW) scheduledAt = istAt(1, hour);
        break;
      case 'RESCHEDULED':
        scheduledAt = istAt(between(1, 6), hour);
        break;
      default:
        scheduledAt = istAt(between(2, 7), hour);
    }

    const createdAt = minDate(plus(scheduledAt, -between(6, 96) * HOUR), ago(between(1, 6) * HOUR));
    const hasTech = !['DRAFT', 'PENDING', 'CONFIRMED'].includes(status) && !(status === 'CANCELLED' && occ % 2 === 0) && status !== 'RESCHEDULED';
    const tech = hasTech ? techFor(cust.city.name, category) : null;
    const assignedAt = tech ? notFuture(plus(createdAt, between(10, 120) * MIN)) : null;
    const reached = ['IN_PROGRESS', 'WAITING_PARTS', 'COMPLETED', 'NO_SHOW'].includes(status);
    const enRouteAt = status === 'TECHNICIAN_EN_ROUTE' ? ago(between(5, 15) * MIN) : reached ? plus(scheduledAt, -between(15, 35) * MIN) : null;
    const arrivedAt = reached ? plus(scheduledAt, between(-5, 40) * MIN) : null;
    const startedAt = reached && status !== 'NO_SHOW' && arrivedAt ? notFuture(plus(arrivedAt, between(3, 10) * MIN)) : null;
    const waitingPartsAt = status === 'WAITING_PARTS' && startedAt ? plus(startedAt, between(30, 60) * MIN) : null;
    const completedAt = status === 'COMPLETED' && startedAt ? notFuture(plus(startedAt, between(45, 150) * MIN)) : null;
    const cancelledAt = status === 'CANCELLED' ? notFuture(plus(createdAt, between(2, 30) * HOUR)) : null;
    const famKey = fam(category);
    const issue = pick(must(ISSUES[famKey] ?? ISSUES.AC, 'issues'));
    const est = catalogItem.basePriceMinor + catalogItem.visitChargeMinor;

    bookings.push({
      n,
      id: did('book', n),
      code: `ACB-${YEAR}-${900000 + n}`,
      status,
      cust,
      appliance,
      category,
      catalogItem,
      tech,
      scheduledAt,
      createdAt,
      assignedAt,
      enRouteAt,
      arrivedAt,
      startedAt,
      waitingPartsAt,
      completedAt,
      cancelledAt,
      mode: wsPlan ? wsPlan[2] : 'ON_SITE',
      ws: wsPlan ? wsPlan[3] : null,
      parent: null,
      priority: weighted<BookingPriority>([
        ['STANDARD', 70],
        ['PRIORITY', 20],
        ['EMERGENCY', 10],
      ]),
      issue,
      estimatedAmountMinor: est > 0 ? est : inr(299),
      leadId: null,
      createdBy: pick(staffIds),
    });
  });

  // Edge case: one very long issue description on an upcoming AC job.
  const longIssueBooking = bookings.find((b) => fam(b.category) === 'AC' && b.status === 'CONFIRMED') ?? bookings.find((b) => b.status === 'CONFIRMED');
  if (longIssueBooking) longIssueBooking.issue = LONG_ISSUE;

  // Warranty revisits (3): free repeat visits on earlier completed AC jobs.
  const revisitParents = bookings
    .filter((b) => b.status === 'COMPLETED' && b.mode === 'ON_SITE' && b.completedAt && b.completedAt < ago(15 * DAY))
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())
    .slice(0, 3);
  const revisitStatuses: BookingStatus[] = ['COMPLETED', 'ASSIGNED', 'CONFIRMED'];
  revisitParents.forEach((parent, k) => {
    const n = bookings.length + 1;
    const status = at(revisitStatuses, k);
    const parentDone = must(parent.completedAt, 'parent completion');
    const scheduledAt = status === 'COMPLETED' ? istAt(Math.round((parentDone.getTime() - NOW.getTime()) / DAY) + 9, 11) : status === 'ASSIGNED' ? istAt(1, 11) : istAt(2, 15);
    const createdAt = minDate(plus(scheduledAt, -2 * DAY), ago(3 * HOUR));
    const tech = status === 'CONFIRMED' ? null : parent.tech;
    const arrivedAt = status === 'COMPLETED' ? plus(scheduledAt, 15 * MIN) : null;
    const startedAt = arrivedAt ? plus(arrivedAt, 5 * MIN) : null;
    bookings.push({
      ...parent,
      n,
      id: did('book', n),
      code: `ACB-${YEAR}-${900000 + n}`,
      status,
      tech,
      scheduledAt,
      createdAt,
      assignedAt: tech ? plus(createdAt, 30 * MIN) : null,
      enRouteAt: arrivedAt ? plus(arrivedAt, -25 * MIN) : null,
      arrivedAt,
      startedAt,
      waitingPartsAt: null,
      completedAt: startedAt ? notFuture(plus(startedAt, 50 * MIN)) : null,
      cancelledAt: null,
      parent,
      priority: 'PRIORITY',
      issue: `Repeat complaint after job ${parent.code}: ${parent.issue.toLowerCase()}`,
      estimatedAmountMinor: 0,
      leadId: null,
    });
  });

  // --------------------------------------------------------------------------
  // Leads (35) — 6 converted to bookings
  // --------------------------------------------------------------------------
  const leadStatuses: LeadStatus[] = [
    ...Array<LeadStatus>(9).fill('NEW'),
    ...Array<LeadStatus>(8).fill('CONTACTED'),
    ...Array<LeadStatus>(6).fill('QUALIFIED'),
    ...Array<LeadStatus>(6).fill('BOOKING_CREATED'),
    ...Array<LeadStatus>(3).fill('CANCELLED'),
    ...Array<LeadStatus>(3).fill('SPAM'),
  ];
  const leadSources: LeadSource[] = ['WEBSITE', 'WHATSAPP', 'GOOGLE_ADS', 'FACEBOOK', 'INSTAGRAM', 'CALL', 'MANUAL', 'REFERRAL'];
  const convertible = bookings.filter((b) => !b.parent && b.status !== 'DRAFT').slice(5, 11);
  const leadRows: Prisma.LeadCreateManyInput[] = [];
  const leadNotes: Prisma.LeadNoteCreateManyInput[] = [];
  const leadActivities: Prisma.LeadActivityCreateManyInput[] = [];
  let prospectIdx = 0;
  let convIdx = 0;
  leadStatuses.forEach((status, i) => {
    const n = i + 1;
    const id = did('lead', n);
    const source = at(leadSources, i);
    const city = at(CITY_SPECS, i % 5 === 4 ? 2 : i % 3 === 2 ? 1 : 0);
    const loc = at(city.localities, i * 5);
    let name: string;
    let phone: string;
    let category: ServiceCategory = weighted(APPLIANCE_WEIGHTS);
    let brand: string | null = pick(must(APPLIANCE_MODELS[category], 'models'))[0];
    let issue: string = pick(must(ISSUES[fam(category)], 'issues'));
    let bookingId: string | null = null;
    let createdAt = ago(between(1, 44) * DAY + between(0, 600) * MIN);
    if (status === 'BOOKING_CREATED') {
      const b = at(convertible, convIdx++);
      name = b.cust.name;
      phone = b.cust.phone;
      category = b.category;
      brand = b.appliance.brand;
      issue = b.issue;
      bookingId = b.id;
      b.leadId = id;
      createdAt = plus(b.createdAt, -between(30, 180) * MIN);
    } else if (status === 'SPAM') {
      name = at(['Asdf Test', 'Free Recharge Offer', 'Unknown Caller'], prospectIdx);
      phone = demoPhone(2000 + n);
      issue = at(['test test test', 'Win ₹5000 cashback click link', 'hello?'], prospectIdx);
      brand = null;
      prospectIdx++;
    } else {
      name = at(PROSPECT_NAMES.filter((x) => !['Asdf Test', 'Free Recharge Offer', 'Unknown Caller'].includes(x)), i);
      phone = demoPhone(2000 + n);
    }
    if (n === 4) issue = LONG_ISSUE;
    if (status === 'NEW') createdAt = ago(between(10, 60 * 30) * MIN);
    const assigned = status !== 'NEW' || i % 3 === 0;
    const assignee = assigned && status !== 'SPAM' ? at([...agentIds, ctx.dispatcherId, did('user', 's03')], i) : null;
    const assignedAt = assignee ? plus(createdAt, between(5, 90) * MIN) : null;
    const contactedAt = ['CONTACTED', 'QUALIFIED', 'BOOKING_CREATED', 'CANCELLED'].includes(status) ? plus(createdAt, between(20, 240) * MIN) : null;
    const qualifiedAt = ['QUALIFIED', 'BOOKING_CREATED'].includes(status) && contactedAt ? plus(contactedAt, between(10, 120) * MIN) : null;
    const closedAt = ['CANCELLED', 'SPAM'].includes(status) ? plus(createdAt, between(1, 48) * HOUR) : null;
    leadRows.push({
      id,
      tenantId: T,
      code: `LD-${YEAR}-${900000 + n}`,
      customerName: name,
      phone,
      whatsappNumber: source === 'WHATSAPP' || chance(0.3) ? phone : null,
      email: status === 'SPAM' || n % 4 === 0 ? null : `${name.split(' ')[0]?.toLowerCase() ?? 'lead'}${n}@example.com`,
      source,
      applianceType: status === 'SPAM' ? null : category,
      applianceBrand: brand,
      issueDescription: issue,
      addressLine1: status === 'SPAM' ? null : `${between(1, 40)}, ${pick(city.buildings)}`,
      addressLine2: status === 'SPAM' ? null : `${pick(city.streets)}, ${loc.name}`,
      cityId: status === 'SPAM' ? null : ctx.cityIds[city.name],
      cityLabel: status === 'SPAM' ? null : city.name,
      pincode: status === 'SPAM' ? null : loc.pincode,
      geoLatitude: status === 'SPAM' ? null : loc.lat,
      geoLongitude: status === 'SPAM' ? null : loc.lng,
      priority: weighted([
        ['LOW', 15],
        ['NORMAL', 55],
        ['HIGH', 22],
        ['URGENT', 8],
      ] as const),
      status,
      tags: status === 'SPAM' ? ['spam'] : n % 3 === 0 ? ['callback-requested'] : n % 5 === 0 ? ['amc-interest', 'high-value'] : [],
      assignedUserId: assignee,
      assignedAt,
      contactedAt,
      qualifiedAt,
      closedAt,
      bookingId,
      convertedAt: bookingId ? plus(createdAt, between(30, 180) * MIN) : null,
      externalRef: source === 'GOOGLE_ADS' || source === 'FACEBOOK' ? `demo-${source.toLowerCase()}-${n}` : null,
      metadata: json({ demo: true, utm_campaign: source === 'GOOGLE_ADS' ? 'ac-repair-blr-search' : undefined }),
      createdAt,
      createdBy: source === 'MANUAL' || source === 'CALL' ? (assignee ?? ctx.adminId) : null,
    });
    let a = 0;
    const act = (type: ActivityType, when: Date, message: string, fromStatus?: string, toStatus?: string, actor?: string | null) =>
      leadActivities.push({
        id: did('lact', `${n}_${++a}`),
        leadId: id,
        tenantId: T,
        type,
        fromStatus: fromStatus ?? null,
        toStatus: toStatus ?? null,
        actorUserId: actor ?? null,
        message,
        createdAt: when,
      });
    act('CREATED', createdAt, `Lead captured via ${source.replace('_', ' ').toLowerCase()}`, undefined, 'NEW');
    if (assignee && assignedAt) act('ASSIGNED', assignedAt, 'Lead assigned', undefined, undefined, ctx.adminId);
    if (contactedAt) act('STATUS_CHANGED', contactedAt, 'Called customer', 'NEW', 'CONTACTED', assignee);
    if (qualifiedAt) act('STATUS_CHANGED', qualifiedAt, 'Requirement confirmed', 'CONTACTED', 'QUALIFIED', assignee);
    if (bookingId) act('CONVERTED_TO_BOOKING', plus(createdAt, 3 * HOUR), 'Converted to booking', 'QUALIFIED', 'BOOKING_CREATED', assignee);
    if (closedAt) act('STATUS_CHANGED', closedAt, status === 'SPAM' ? 'Marked as spam' : 'Customer not interested', contactedAt ? 'CONTACTED' : 'NEW', status, assignee ?? ctx.adminId);
    if (assignee && (status === 'CONTACTED' || status === 'QUALIFIED')) {
      leadNotes.push({
        id: did('lnote', n),
        leadId: id,
        tenantId: T,
        authorUserId: assignee,
        body: pick([
          'Customer asked for a call back after 6 pm.',
          'Wants a quote for AMC covering 3 ACs. Sent plan details on WhatsApp.',
          'Comparing prices with local vendor — offered first-visit discount.',
          'Needs a visit on Saturday morning only.',
        ]),
        createdAt: plus(contactedAt ?? createdAt, 10 * MIN),
      });
    }
  });

  // --------------------------------------------------------------------------
  // Inventory masters (needed by invoices / workshop)
  // --------------------------------------------------------------------------
  const warehouseSpecs = [
    { code: 'WH-BLR-CENTRAL', name: 'Bengaluru Central Warehouse', kind: 'CENTRAL' as const, city: 'Bengaluru' as const, a1: 'Plot 42, 2nd Phase, Peenya Industrial Area', pin: '560058', gstin: '29AAHCA5521Q1ZK' },
    { code: 'WH-MUM-ANDHERI', name: 'Mumbai Andheri Branch', kind: 'BRANCH' as const, city: 'Mumbai' as const, a1: 'Unit 12, Marol Co-op Industrial Estate, Andheri East', pin: '400059', gstin: '27AAHCA5521Q1ZO' },
    { code: 'WH-DEL-OKHLA', name: 'Delhi Okhla Branch', kind: 'BRANCH' as const, city: 'Delhi' as const, a1: 'B-118, Okhla Industrial Area Phase II', pin: '110020', gstin: '07AAHCA5521Q1ZM' },
  ];
  const warehouses: Prisma.WarehouseCreateManyInput[] = warehouseSpecs.map((w, i) => ({
    id: did('wh', i + 1),
    tenantId: T,
    code: w.code,
    name: w.name,
    kind: w.kind,
    cityId: ctx.cityIds[w.city],
    addressLine1: w.a1,
    pincode: w.pin,
    state: must(CITY_SPECS.find((c) => c.name === w.city), w.city).state,
    gstin: w.gstin,
    managerUserId: i === 0 ? ctx.dispatcherId : did('user', 's03'),
    createdAt: ago(200 * DAY),
    createdBy: ctx.adminId,
  }));
  const zones: Prisma.WarehouseZoneCreateManyInput[] = [];
  warehouses.forEach((w, wi) => {
    [
      ['A', 'Refrigerants & gas'],
      ['B', 'Electrical & PCBs'],
      ['C', 'Filters & consumables'],
    ].forEach(([code, name], zi) => {
      zones.push({ id: did('zone', `${wi + 1}${code}`), tenantId: T, warehouseId: must(w.id, 'wh'), code: `${code}-RACK`, name: name ?? '', binLabel: `${code}.${zi + 1}.1` });
    });
  });
  const vendorSpecs = [
    { code: 'VEN-SLRS', company: 'Sri Lakshmi Refrigeration Spares', city: 'Bengaluru', state: 'Karnataka', gstin: '29ABKFS1123H1Z9', contact: 'Nagaraj K', cats: ['Refrigerant', 'Capacitor', 'Motor', 'Piping'], status: 'ACTIVE' as const, rating: 4.5, onTime: 0.93, terms: 30, a1: '#18, SP Road, Chickpet', pin: '560002' },
    { code: 'VEN-MCC', company: 'Mumbai Cooling Components Pvt Ltd', city: 'Mumbai', state: 'Maharashtra', gstin: '27AAECM8812L1ZT', contact: 'Hitesh Doshi', cats: ['PCB', 'Sensor', 'Motor'], status: 'ACTIVE' as const, rating: 4.1, onTime: 0.86, terms: 45, a1: 'Gala 7, Lamington Road, Grant Road East', pin: '400007' },
    { code: 'VEN-DEP', company: 'Delhi Electro Parts Co.', city: 'Delhi', state: 'Delhi', gstin: '07AAGFD4410C1ZE', contact: 'Rajiv Arora', cats: ['Backlight', 'PCB', 'Magnetron', 'Battery'], status: 'ON_HOLD' as const, rating: 3.4, onTime: 0.71, terms: 15, a1: '1432, Bhagirath Place, Chandni Chowk', pin: '110006' },
    { code: 'VEN-APF', company: 'AquaPure Filters India', city: 'Bengaluru', state: 'Karnataka', gstin: '29AAPCA7765D1Z2', contact: 'Sowmya R', cats: ['Filter', 'Pump', 'Valve', 'Bearing', 'Belt', 'Door lock', 'Heater', 'Thermostat', 'Gasket', 'Electrical'], status: 'ACTIVE' as const, rating: 4.7, onTime: 0.97, terms: 30, a1: '55, KIADB Industrial Area, Bommasandra', pin: '560099' },
  ];
  const vendors: Prisma.VendorCreateManyInput[] = vendorSpecs.map((v, i) => ({
    id: did('ven', i + 1),
    tenantId: T,
    code: v.code,
    companyName: v.company,
    legalName: v.company.endsWith('Ltd') ? v.company : `${v.company} (Prop.)`,
    gstin: v.gstin,
    pan: v.gstin.slice(2, 12),
    contactPerson: v.contact,
    email: i === 2 ? null : `sales@${v.code.toLowerCase().replace('ven-', '')}.example`,
    phone: demoPhone(850 + i),
    addressLine1: v.a1,
    city: v.city,
    state: v.state,
    pincode: v.pin,
    paymentTermsDays: v.terms,
    categoriesSupplied: v.cats,
    rating: v.rating,
    onTimeRate: v.onTime,
    lifetimeSpendMinor: inr(between(80, 900) * 1000),
    bankName: pick(['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank']),
    bankAccountNumber: `XXXXXX${between(1000, 9999)}`,
    ifsc: pick(['HDFC0001234', 'ICIC0000456', 'SBIN0004321', 'UTIB0000789']),
    notes: i === 2 ? 'On hold — two consecutive late deliveries in September.' : null,
    status: v.status,
    createdAt: ago(between(150, 300) * DAY),
    createdBy: ctx.adminId,
  }));
  const vendorForCategory = (cat: string): string => {
    const idx = vendorSpecs.findIndex((v) => v.cats.includes(cat));
    return did('ven', idx >= 0 ? idx + 1 : 1);
  };
  const items: Prisma.InventoryItemCreateManyInput[] = ITEM_SPECS.map((s, i) => ({
    id: did('item', i + 1),
    tenantId: T,
    sku: s.sku,
    barcode: `890${String(4000000000 + i * 7919).slice(0, 10)}`,
    name: s.name,
    description: i % 4 === 0 ? `${s.name}. Compatible with most ${s.brands.length ? s.brands.join(', ') : 'major brand'} models; check part number before fitting.` : null,
    type: s.type ?? 'SPARE_PART',
    category: s.category,
    brand: s.brand ?? null,
    compatibleApplianceCategories: s.cats,
    compatibleBrands: s.brands,
    unit: s.unit ?? 'PIECE',
    costPriceMinor: inr(s.cost),
    sellingPriceMinor: inr(s.sell),
    gstRateBps: s.type === 'TOOL' ? 1800 : s.category === 'Battery' ? 2800 : 1800,
    hsnCode: s.hsn,
    serialTracking: ['PCB', 'Battery', 'Magnetron'].includes(s.category),
    batchTracking: s.category === 'Refrigerant' || s.category === 'Filter',
    shelfLifeDays: s.category === 'Refrigerant' ? 1095 : null,
    warrantyDays: s.warrantyDays ?? null,
    preferredVendorId: vendorForCategory(s.category),
    defaultReorderLevel: s.reorder,
    defaultReorderQty: s.reorder * 2,
    createdAt: ago(between(120, 200) * DAY),
    createdBy: ctx.adminId,
  }));
  const itemBySku = (sku: string) => {
    const i = ITEM_SPECS.findIndex((s) => s.sku === sku);
    if (i < 0) throw new Error(`unknown sku ${sku}`);
    return { id: did('item', i + 1), spec: must(ITEM_SPECS[i], sku) };
  };
  const partsFor = (category: ServiceCategory) =>
    ITEM_SPECS.map((s, i) => ({ s, id: did('item', i + 1) })).filter((x) => x.s.type !== 'TOOL' && x.s.cats.includes(category) && x.s.sell > 0);

  // --------------------------------------------------------------------------
  // Invoices, payments, ledger (for completed bookings)
  // --------------------------------------------------------------------------
  const invoiceStatusSeq: InvoiceStatus[] = [
    'PAID', 'PAID', 'OVERDUE', 'PAID', 'PAID', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'PAID', 'PAID',
    'OVERDUE', 'PAID', 'PARTIALLY_PAID', 'PAID', 'PAID', 'SENT', 'PAID', 'PARTIALLY_PAID', 'PAID', 'PAID',
    'PARTIALLY_PAID', 'SENT', 'PAID', 'DRAFT', 'SENT', 'DRAFT', 'DRAFT',
  ];
  const invoices: Prisma.InvoiceCreateManyInput[] = [];
  const invoiceLines: Prisma.InvoiceLineItemCreateManyInput[] = [];
  const payments: Prisma.PaymentCreateManyInput[] = [];
  const paymentTxns: Prisma.PaymentTransactionCreateManyInput[] = [];
  interface LedgerEvent {
    customerId: string;
    at: Date;
    type: 'INVOICE' | 'PAYMENT';
    amount: number;
    description: string;
    invoiceId: string;
    paymentId?: string;
    amcSubscriptionId?: string;
    ref: string;
  }
  const ledgerEvents: LedgerEvent[] = [];
  const bookingMoney = new Map<string, { final: number; paid: number; status: 'UNPAID' | 'PARTIAL' | 'PAID'; discount: number; coupon: string | null }>();
  const custPaid = new Map<string, number>();
  let invSeq = 0;
  let paySeq = 0;
  const methods: PaymentMethod[] = ['UPI', 'UPI', 'CASH', 'RAZORPAY', 'CARD', 'UPI', 'NET_BANKING'];
  const couponForInvoice: Record<number, { code: string; couponIdx: number; discount: number }> = {
    1: { code: 'WELCOME150', couponIdx: 1, discount: inr(150) },
    4: { code: 'MONSOON20', couponIdx: 2, discount: inr(300) },
    9: { code: 'MONSOON20', couponIdx: 2, discount: inr(240) },
    13: { code: 'WELCOME150', couponIdx: 1, discount: inr(150) },
  };
  const redemptions: Prisma.CouponRedemptionCreateManyInput[] = [];

  function addPayment(invoiceId: string, customerId: string, amount: number, when: Date, method: PaymentMethod, invoiceNo: string) {
    paySeq += 1;
    const payId = did('pay', paySeq);
    let transactionId: string | null = null;
    if (method === 'RAZORPAY' || method === 'CARD') {
      transactionId = did('ptxn', paySeq);
      paymentTxns.push({
        id: transactionId,
        tenantId: T,
        customerId,
        invoiceId,
        purpose: 'INVOICE',
        provider: 'razorpay',
        method,
        status: 'CAPTURED',
        amountMinor: amount,
        orderRef: `order_DEMO${alnum(10)}`,
        paymentRef: `pay_DEMO${alnum(10)}`,
        hostedLink: `https://rzp.io/i/demo${alnum(6).toLowerCase()}`,
        idempotencyKey: `demo-ptxn-${paySeq}`,
        authorizedAt: plus(when, -MIN),
        capturedAt: when,
        version: 2,
        createdAt: plus(when, -5 * MIN),
      });
    }
    payments.push({
      id: payId,
      tenantId: T,
      invoiceId,
      method,
      status: 'CAPTURED',
      amountMinor: amount,
      gatewayRef: method === 'UPI' ? `UPI/${between(100000, 999999)}${between(100000, 999999)}` : method === 'CASH' ? null : `pay_DEMO${alnum(10)}`,
      capturedAt: when,
      transactionId,
      createdAt: when,
    });
    ledgerEvents.push({ customerId, at: when, type: 'PAYMENT', amount, description: `Payment received — ${invoiceNo} (${method})`, invoiceId, paymentId: payId, ref: `demo:pay:${payId}` });
    custPaid.set(customerId, (custPaid.get(customerId) ?? 0) + amount);
  }

  const completedRegular = bookings
    .filter((b) => b.status === 'COMPLETED' && !b.parent)
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  completedRegular.forEach((b, k) => {
    const status = at(invoiceStatusSeq, k);
    invSeq += 1;
    const invId = did('inv', invSeq);
    const number = docNo('INV', invSeq);
    const done = must(b.completedAt, 'completedAt');
    const lines: LineCalc[] = [];
    const ci = b.catalogItem;
    if (ci.visitChargeMinor > 0) lines.push(line(`Visit & diagnosis charge — ${ci.name}`, 1, ci.visitChargeMinor, ci.sacCode ?? '998719'));
    if (ci.basePriceMinor > 0) lines.push(line(ci.name, 1, ci.basePriceMinor, ci.sacCode ?? '998719'));
    const parts = partsFor(b.category);
    if (parts.length > 0 && (chance(0.55) || ci.basePriceMinor === 0)) {
      const part = pick(parts);
      const qty = part.s.unit === 'METER' ? between(2, 5) : 1;
      lines.push(line(`${part.s.name} (${part.s.sku})`, qty, inr(part.s.sell), part.s.hsn, part.s.category === 'Battery' ? 2800 : 1800));
    }
    if (lines.length === 0) lines.push(line('General service charge', 1, inr(299), '998719'));
    const subtotal = lines.reduce((s, l) => s + l.subtotalMinor, 0);
    const tax = lines.reduce((s, l) => s + l.taxMinor, 0);
    const coupon = couponForInvoice[k] && status === 'PAID' ? couponForInvoice[k] : undefined;
    const discount = coupon?.discount ?? 0;
    const total = subtotal - discount + tax;
    let paid = 0;
    if (status === 'PAID') paid = total;
    if (status === 'PARTIALLY_PAID') paid = Math.round((total * pick([40, 50, 60])) / 100 / 100) * 100;
    const issueDate = status === 'DRAFT' ? null : plus(done, 10 * MIN);
    const dueDate = issueDate ? plus(issueDate, 7 * DAY) : null;
    const paidAt = status === 'PAID' ? notFuture(plus(done, chance(0.5) ? 20 * MIN : between(1, 3) * DAY)) : null;
    invoices.push({
      id: invId,
      tenantId: T,
      number,
      bookingId: b.id,
      customerId: b.cust.id,
      status,
      issueDate,
      dueDate,
      paidAt,
      sentAt: issueDate && status !== 'DRAFT' ? plus(issueDate, 2 * MIN) : null,
      cancelledAt: status === 'CANCELLED' ? plus(done, 2 * DAY) : null,
      subtotalMinor: subtotal,
      discountMinor: discount,
      taxMinor: tax,
      totalMinor: total,
      amountPaidMinor: paid,
      dueAmountMinor: status === 'CANCELLED' ? 0 : total - paid,
      gstEnabled: true,
      gstNumber: b.cust.i in accountForCustomer ? (accountSpecs.find((_, ai) => did('acct', ai + 1) === accountForCustomer[b.cust.i])?.gstin ?? null) : null,
      placeOfSupply: b.cust.city.stateCode,
      notes: status === 'CANCELLED' ? 'Cancelled — duplicate invoice raised by technician app.' : k % 6 === 0 ? 'Thank you for choosing us! Repair is covered by our service warranty.' : null,
      terms: 'Payment due within 7 days. Repair warranty as per job card.',
      generatedBy: b.tech?.userId ?? ctx.adminId,
      metadata: json({ demo: true }),
      createdAt: plus(done, 5 * MIN),
    });
    lines.forEach((l, li) => {
      const cgst = Math.floor(l.taxMinor / 2);
      invoiceLines.push({ id: did('invl', `${invSeq}_${li + 1}`), invoiceId: invId, ...l, cgstMinor: cgst, sgstMinor: l.taxMinor - cgst, createdAt: plus(done, 5 * MIN) });
    });
    if (issueDate && status !== 'CANCELLED') {
      ledgerEvents.push({ customerId: b.cust.id, at: issueDate, type: 'INVOICE', amount: total, description: `Invoice ${number} — ${b.code}`, invoiceId: invId, ref: `demo:inv:${invId}` });
    }
    if (status === 'PAID' && paidAt) addPayment(invId, b.cust.id, total, paidAt, at(methods, k), number);
    if (status === 'PARTIALLY_PAID') addPayment(invId, b.cust.id, paid, notFuture(plus(done, 30 * MIN)), 'CASH', number);
    if (coupon) {
      redemptions.push({ id: did('credm', k), tenantId: T, couponId: did('coupon', coupon.couponIdx), customerId: b.cust.id, bookingId: b.id, invoiceId: invId, discountMinor: discount, createdAt: done });
    }
    bookingMoney.set(b.id, {
      final: total,
      paid,
      status: status === 'PAID' ? 'PAID' : status === 'PARTIALLY_PAID' ? 'PARTIAL' : 'UNPAID',
      discount,
      coupon: coupon?.code ?? null,
    });
  });

  // --------------------------------------------------------------------------
  // AMC subscriptions + visits (+ AMC invoices)
  // --------------------------------------------------------------------------
  const amcSpecs: { cust: number; slug: string; status: 'ACTIVE' | 'EXPIRED' | 'PENDING_PAYMENT' | 'CANCELLED' | 'PAUSED'; startDaysAgo: number; invoice?: 'PAID' | 'SENT' }[] = [
    { cust: 3, slug: 'premium', status: 'ACTIVE', startDaysAgo: 200, invoice: 'PAID' },
    { cust: 7, slug: 'standard', status: 'ACTIVE', startDaysAgo: 350 },
    { cust: 11, slug: 'basic', status: 'ACTIVE', startDaysAgo: 30, invoice: 'PAID' },
    { cust: 15, slug: 'standard', status: 'ACTIVE', startDaysAgo: 100, invoice: 'PAID' },
    { cust: 19, slug: 'basic', status: 'EXPIRED', startDaysAgo: 400 },
    { cust: 26, slug: 'standard', status: 'EXPIRED', startDaysAgo: 375 },
    { cust: 30, slug: 'premium', status: 'PENDING_PAYMENT', startDaysAgo: 0, invoice: 'SENT' },
    { cust: 38, slug: 'basic', status: 'CANCELLED', startDaysAgo: 150 },
    { cust: 41, slug: 'standard', status: 'PAUSED', startDaysAgo: 120 },
  ];
  const amcSubs: Prisma.AMCSubscriptionCreateManyInput[] = [];
  const amcVisits: Prisma.AMCVisitCreateManyInput[] = [];
  amcSpecs.forEach((s, k) => {
    const p = plan(s.slug);
    const cust = at(customers, s.cust - 1);
    const id = did('amc', k + 1);
    const startsAt = istAt(-s.startDaysAgo, 10);
    const endsAt = plus(startsAt, p.durationMonths * 30.4 * DAY);
    let scheduled = 0;
    let completed = 0;
    for (let v = 1; v <= p.includedVisits; v++) {
      const when = plus(startsAt, (v - 1) * p.visitCadenceDays * DAY + 14 * DAY);
      let vs: 'SCHEDULED' | 'CONFIRMED' | 'COMPLETED' | 'MISSED' | 'CANCELLED' = 'SCHEDULED';
      if (s.status === 'CANCELLED' && when > ago(-1)) vs = 'CANCELLED';
      else if (when < NOW) vs = (k + v) % 5 === 0 ? 'MISSED' : 'COMPLETED';
      else if (when < plus(NOW, 7 * DAY)) vs = 'CONFIRMED';
      if (s.status === 'PENDING_PAYMENT') vs = 'SCHEDULED';
      scheduled += 1;
      if (vs === 'COMPLETED') completed += 1;
      amcVisits.push({
        id: did('amcv', `${k + 1}_${v}`),
        tenantId: T,
        subscriptionId: id,
        visitNumber: v,
        status: vs,
        scheduledFor: when,
        completedAt: vs === 'COMPLETED' ? plus(when, 2 * HOUR) : null,
        missedAt: vs === 'MISSED' ? plus(when, DAY) : null,
        cancelledAt: vs === 'CANCELLED' ? ago(between(5, 20) * DAY) : null,
        notes: vs === 'MISSED' ? 'Customer not reachable on visit day.' : null,
        createdAt: startsAt,
      });
    }
    amcSubs.push({
      id,
      tenantId: T,
      number: docNo('AMC', k + 1),
      customerId: cust.id,
      planId: p.id,
      status: s.status,
      startsAt,
      endsAt,
      cancelledAt: s.status === 'CANCELLED' ? ago(20 * DAY) : null,
      pausedAt: s.status === 'PAUSED' ? ago(12 * DAY) : null,
      priceMinor: p.priceMinor,
      renewalPriceMinor: p.renewalPriceMinor,
      autoRenew: k % 3 !== 1,
      visitsScheduled: scheduled,
      visitsCompleted: completed,
      appliancesSnapshot: json(
        cust.appliances
          .filter((a) => p.appliancesCovered.some((c) => fam(c) === fam(a.category)))
          .map((a) => ({ applianceId: a.id, category: a.category, brand: a.brand, model: a.model })),
      ),
      metadata: json({ demo: true, salesRep: pick(['Farah Ansari', 'Rakesh Yadav']), source: pick(['website', 'technician-upsell', 'call-center']) }),
      createdAt: plus(startsAt, -DAY),
    });
    if (s.invoice) {
      invSeq += 1;
      const invId = did('inv', invSeq);
      const number = docNo('INV', invSeq);
      const l = line(`${p.name} — ${p.durationMonths} months`, 1, p.priceMinor, '998719');
      const issue = s.status === 'PENDING_PAYMENT' ? ago(2 * DAY) : plus(startsAt, -DAY);
      const paid = s.invoice === 'PAID' ? l.totalMinor : 0;
      invoices.push({
        id: invId,
        tenantId: T,
        number,
        amcSubscriptionId: id,
        customerId: cust.id,
        status: s.invoice,
        issueDate: issue,
        dueDate: plus(issue, 7 * DAY),
        sentAt: plus(issue, 2 * MIN),
        paidAt: s.invoice === 'PAID' ? plus(issue, 3 * HOUR) : null,
        subtotalMinor: l.subtotalMinor,
        taxMinor: l.taxMinor,
        totalMinor: l.totalMinor,
        amountPaidMinor: paid,
        dueAmountMinor: l.totalMinor - paid,
        placeOfSupply: cust.city.stateCode,
        terms: 'AMC is activated on receipt of payment.',
        generatedBy: ctx.adminId,
        externalRef: `amc:${id}`,
        metadata: json({ demo: true, kind: 'AMC' }),
        createdAt: issue,
      });
      const cgst = Math.floor(l.taxMinor / 2);
      invoiceLines.push({ id: did('invl', `${invSeq}_1`), invoiceId: invId, ...l, cgstMinor: cgst, sgstMinor: l.taxMinor - cgst, createdAt: issue });
      ledgerEvents.push({ customerId: cust.id, at: issue, type: 'INVOICE', amount: l.totalMinor, description: `Invoice ${number} — ${p.name}`, invoiceId: invId, amcSubscriptionId: id, ref: `demo:inv:${invId}` });
      if (paid > 0) addPayment(invId, cust.id, paid, plus(issue, 3 * HOUR), 'RAZORPAY', number);
    }
  });

  // Running customer ledger.
  const ledgerRows: Prisma.CustomerLedgerEntryCreateManyInput[] = [];
  const balances = new Map<string, number>();
  ledgerEvents
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .forEach((e, i) => {
      const prev = balances.get(e.customerId) ?? 0;
      const next = e.type === 'INVOICE' ? prev + e.amount : prev - e.amount;
      balances.set(e.customerId, next);
      ledgerRows.push({
        id: did('ledg', i + 1),
        tenantId: T,
        customerId: e.customerId,
        entryType: e.type,
        direction: e.type === 'INVOICE' ? 'DEBIT' : 'CREDIT',
        amountMinor: e.amount,
        description: e.description,
        invoiceId: e.invoiceId,
        paymentId: e.paymentId ?? null,
        amcSubscriptionId: e.amcSubscriptionId ?? null,
        runningBalanceMinor: next,
        externalRef: e.ref,
        occurredAt: e.at,
        createdAt: e.at,
      });
    });

  // --------------------------------------------------------------------------
  // Booking rows (now that money is known)
  // --------------------------------------------------------------------------
  const bookingRows: Prisma.BookingCreateManyInput[] = bookings.map((b) => {
    const money = bookingMoney.get(b.id);
    return {
      id: b.id,
      tenantId: T,
      code: b.code,
      leadId: b.leadId,
      customerId: b.cust.id,
      technicianId: b.tech?.id ?? null,
      cityId: ctx.cityIds[b.cust.city.name],
      addressId: b.cust.addressId,
      category: b.category,
      serviceType: b.catalogItem.name,
      applianceBrand: b.appliance.brand,
      applianceType: `${b.appliance.capacity} ${b.appliance.category === 'AC_REPAIR' ? 'split AC' : b.appliance.category.toLowerCase().replace(/_/g, ' ')}`,
      issueDescription: b.issue,
      status: b.status,
      priority: b.priority,
      paymentStatus: money?.status ?? 'UNPAID',
      scheduledAt: b.scheduledAt,
      scheduledTimeSlot: slotLabel(b.scheduledAt),
      assignedAt: b.assignedAt,
      enRouteAt: b.enRouteAt,
      arrivedAt: b.arrivedAt,
      startedAt: b.startedAt,
      waitingPartsAt: b.waitingPartsAt,
      completedAt: b.completedAt,
      cancelledAt: b.cancelledAt,
      cancellationReason: b.status === 'CANCELLED' ? pick(['Customer fixed it themselves', 'Customer travelling, will rebook', 'Price too high', 'Duplicate booking']) : null,
      rescheduledFromAt: b.status === 'RESCHEDULED' ? plus(b.scheduledAt, -between(1, 3) * DAY) : null,
      rescheduleCount: b.status === 'RESCHEDULED' ? between(1, 2) : 0,
      notes: b.n % 9 === 0 ? 'Call before arriving — lift under maintenance, use stairs.' : null,
      otpVerifiedAt: b.startedAt ? plus(b.startedAt, -2 * MIN) : null,
      customerSignatureUrl: b.status === 'COMPLETED' ? img('Signature') : null,
      estimatedAmountMinor: b.estimatedAmountMinor,
      finalAmountMinor: money?.final ?? (b.status === 'COMPLETED' ? 0 : null),
      addressSnapshot: json(b.cust.address),
      geoLatitude: b.cust.lat,
      geoLongitude: b.cust.lng,
      applianceId: b.appliance.id,
      catalogItemId: b.catalogItem.id,
      serviceMode: b.mode,
      parentBookingId: b.parent?.id ?? null,
      isWarrantyRevisit: !!b.parent,
      repairWarrantyUntil: b.completedAt && b.catalogItem.repairWarrantyDays > 0 ? plus(b.completedAt, b.catalogItem.repairWarrantyDays * DAY) : null,
      couponCode: money?.coupon ?? null,
      discountMinor: money?.discount ?? 0,
      metadata: json({ demo: true }),
      createdAt: b.createdAt,
      createdBy: b.createdBy,
      updatedBy: b.createdBy,
    };
  });

  // Booking timeline.
  const bookingActivities: Prisma.BookingActivityCreateManyInput[] = [];
  const bookingNotes: Prisma.BookingNoteCreateManyInput[] = [];
  for (const b of bookings) {
    let a = 0;
    const act = (type: ActivityType, when: Date | null, message: string, fromStatus?: BookingStatus | null, toStatus?: BookingStatus | null, actor?: string | null, metadata?: Record<string, unknown>) => {
      if (!when) return;
      bookingActivities.push({
        id: did('bact', `${b.n}_${++a}`),
        bookingId: b.id,
        tenantId: T,
        type,
        fromStatus: fromStatus ?? null,
        toStatus: toStatus ?? null,
        actorUserId: actor ?? null,
        message,
        metadata: json({ demo: true, ...metadata }),
        createdAt: when,
      });
    };
    const techUser = b.tech?.userId ?? null;
    act('CREATED', b.createdAt, `Booking ${b.code} created`, null, b.status === 'DRAFT' ? 'DRAFT' : 'PENDING', b.createdBy, { code: b.code });
    if (b.status === 'DRAFT') continue;
    const confirmedAt = plus(b.createdAt, 8 * MIN);
    if (b.status !== 'PENDING') act('STATUS_CHANGED', confirmedAt, 'Booking confirmed with customer', 'PENDING', 'CONFIRMED', b.createdBy);
    if (b.tech && b.assignedAt) act('ASSIGNED', b.assignedAt, `Assigned to ${b.tech.name}`, 'CONFIRMED', 'ASSIGNED', ctx.dispatcherId, { technicianId: b.tech.id });
    if (b.status === 'RESCHEDULED') act('RESCHEDULED', plus(b.createdAt, 3 * HOUR), 'Customer requested a different slot', 'CONFIRMED', 'RESCHEDULED', b.createdBy);
    act('TECHNICIAN_EN_ROUTE', b.enRouteAt, 'Technician started travelling', 'ASSIGNED', 'TECHNICIAN_EN_ROUTE', techUser);
    act('ARRIVED_ON_SITE', b.arrivedAt, 'Technician reached the location', null, null, techUser);
    if (b.status === 'NO_SHOW') act('STATUS_CHANGED', b.arrivedAt ? plus(b.arrivedAt, 25 * MIN) : null, 'Customer not available at site — marked no-show', 'TECHNICIAN_EN_ROUTE', 'NO_SHOW', techUser);
    if (b.startedAt) {
      act('OTP_VERIFIED', plus(b.startedAt, -2 * MIN), 'Customer OTP verified', null, null, techUser);
      act('STATUS_CHANGED', b.startedAt, 'Work started', 'TECHNICIAN_EN_ROUTE', 'IN_PROGRESS', techUser);
    }
    act('WAITING_PARTS', b.waitingPartsAt, 'Waiting for spare part from warehouse', 'IN_PROGRESS', 'WAITING_PARTS', techUser);
    if (b.completedAt) {
      act('SIGNATURE_CAPTURED', plus(b.completedAt, -3 * MIN), 'Customer signature captured', null, null, techUser);
      act('COMPLETED', b.completedAt, 'Job completed', 'IN_PROGRESS', 'COMPLETED', techUser);
      const money = bookingMoney.get(b.id);
      if (money && money.paid > 0) act('PAYMENT_RECORDED', notFuture(plus(b.completedAt, 20 * MIN)), `Payment of ₹${(money.paid / 100).toFixed(2)} recorded`, null, null, techUser);
    }
    if (b.cancelledAt) act('CANCELLED', b.cancelledAt, 'Booking cancelled at customer request', 'CONFIRMED', 'CANCELLED', b.createdBy);
    if (b.n % 5 === 0) {
      act('NOTE_ADDED', plus(b.createdAt, 20 * MIN), 'Internal note added', null, null, b.createdBy);
      bookingNotes.push({
        id: did('bnote', b.n),
        bookingId: b.id,
        tenantId: T,
        authorUserId: b.createdBy,
        body: pick([
          'Customer prefers Kannada/Hindi speaking technician.',
          'Society allows service entry only between 10 am and 6 pm.',
          'Previous technician quoted ₹4,500 for compressor work — customer wants a second opinion.',
          'Senior citizen at home — please be patient and explain the charges before starting.',
          'Gate pass required. Security desk number shared on WhatsApp.',
        ]),
        isInternal: b.n % 10 !== 0,
        createdAt: plus(b.createdAt, 20 * MIN),
      });
    }
  }

  // --------------------------------------------------------------------------
  // Job cards, workshop jobs, ratings
  // --------------------------------------------------------------------------
  const jobCards: Prisma.JobCardCreateManyInput[] = [];
  const workshopJobs: Prisma.WorkshopJobCreateManyInput[] = [];
  const ratings: Prisma.BookingRatingCreateManyInput[] = [];
  const parentIds = new Set(bookings.filter((b) => b.parent).map((b) => must(b.parent, 'parent').id));
  const templatesFor = (category: ServiceCategory) => checklistTemplates.filter((t) => t.category === category);
  const answerFor = (item: { key: string; type: string }, readings: Record<string, number>): unknown => {
    if (item.type === 'bool') return item.key === 'physicalDamage' ? false : true;
    if (item.type === 'number') return readings[item.key] ?? between(1, 20);
    if (item.type === 'photo') return img(item.key);
    return 'As described by customer at booking';
  };
  let ratingCount = 0;
  for (const b of bookings) {
    if (!['IN_PROGRESS', 'WAITING_PARTS', 'COMPLETED'].includes(b.status) || !b.tech) continue;
    const famKey = fam(b.category);
    const readings = (READINGS[famKey] ?? (() => ({ supplyVoltage: between(220, 238) })))();
    const done = b.status === 'COMPLETED';
    const kinds = done ? ['SAFETY', 'PRE_SERVICE', 'POST_SERVICE'] : ['SAFETY', 'PRE_SERVICE'];
    const checklist = templatesFor(b.category)
      .filter((t) => kinds.includes(t.kind))
      .map((t) => {
        const answers: Record<string, unknown> = {};
        const tplItems = Array.isArray(t.items) ? (t.items as unknown as { key: string; type: string }[]) : [];
        for (const it of tplItems) answers[it.key] = answerFor(it, readings);
        return { templateId: t.id, kind: t.kind, answers };
      });
    const codes = faultCodes.filter((f) => fam(f.category) === famKey && (!f.brand || f.brand === b.appliance.brand));
    const [diagnosis, rootCause, resolution] = pick(must(DIAGNOSES[famKey] ?? DIAGNOSES.AC, 'diagnoses'));
    const parts = partsFor(b.category);
    jobCards.push({
      id: did('jc', b.n),
      tenantId: T,
      bookingId: b.id,
      technicianId: b.tech.id,
      applianceId: b.appliance.id,
      status: done ? 'COMPLETED' : 'IN_PROGRESS',
      symptoms: [pick(must(SYMPTOMS[famKey], 'symptoms')), ...(chance(0.4) ? [pick(must(SYMPTOMS[famKey], 'symptoms'))] : [])].filter((v, i, arr) => arr.indexOf(v) === i),
      faultCodes: codes.length > 0 ? [pick(codes).code] : [],
      diagnosis,
      rootCause: done || b.status === 'WAITING_PARTS' ? rootCause : null,
      resolution: done ? resolution : null,
      readings: json(readings),
      checklist: json(checklist),
      partsRecommended: json(
        b.status === 'WAITING_PARTS' && parts.length > 0
          ? [{ sku: pick(parts).s.sku, name: pick(parts).s.name, quantity: 1, reason: 'Faulty part confirmed on diagnosis' }]
          : [],
      ),
      photos: done ? [img('Before'), img('After')] : [img('Before')],
      firstTimeFix: done ? !(parentIds.has(b.id) || b.n % 8 === 0) : null,
      technicianRemarks: done ? pick(['Advised customer to clean filters monthly.', 'Recommended voltage stabiliser.', 'Unit working fine after repair.', null]) : 'Diagnosis in progress',
      customerRemarks: done && chance(0.4) ? pick(['Happy with the service', 'Please send the same technician next time']) : null,
      startedAt: b.startedAt,
      completedAt: b.completedAt,
      createdAt: b.startedAt ?? b.createdAt,
      createdBy: b.tech.userId,
    });
    if (done && b.tech && ratingCount < 23 && b.n % 6 !== 1) {
      ratingCount += 1;
      const value = parentIds.has(b.id) ? 2 : weighted<number>([
        [5, 50],
        [4, 30],
        [3, 12],
        [2, 8],
      ]);
      const completedAt = must(b.completedAt, 'completedAt');
      ratings.push({
        id: did('rate', b.n),
        tenantId: T,
        bookingId: b.id,
        customerId: b.cust.id,
        technicianId: b.tech.id,
        value,
        npsScore: chance(0.6) ? Math.min(10, value * 2 - between(0, 1)) : null,
        comment: chance(0.7) ? pick(must(RATING_COMMENTS[value], 'comments')) : null,
        reviewRequestedAt: plus(completedAt, 30 * MIN),
        publicReviewUrl: value === 5 && chance(0.3) ? 'https://g.page/r/demo-review' : null,
        createdAt: notFuture(plus(completedAt, between(1, 20) * HOUR)),
      });
    }
  }
  const WS_ORDER: WorkshopJobStatus[] = ['PICKUP_SCHEDULED', 'PICKED_UP', 'RECEIVED_AT_WORKSHOP', 'DIAGNOSING', 'AWAITING_APPROVAL', 'REPAIRING', 'READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY', 'DELIVERED'];
  let wsSeq = 0;
  for (const b of bookings) {
    if (!b.ws) continue;
    wsSeq += 1;
    const target = WS_ORDER.indexOf(b.ws);
    const steps = WS_ORDER.slice(b.mode === 'CARRY_IN' ? 2 : 0, target + 1).filter((s) => !(b.mode === 'CARRY_IN' && (s === 'OUT_FOR_DELIVERY' || s === 'PICKED_UP')));
    const t0 = b.status === 'COMPLETED' ? plus(must(b.completedAt, 'done'), -4 * DAY) : minDate(b.createdAt, ago(3 * DAY));
    const span = (b.status === 'COMPLETED' ? must(b.completedAt, 'done').getTime() : ago(30 * MIN).getTime()) - t0.getTime();
    const stamp = (s: WorkshopJobStatus): Date | null => {
      const i = steps.indexOf(s);
      return i < 0 ? null : new Date(t0.getTime() + (span * i) / Math.max(1, steps.length - 1));
    };
    const future = b.ws === 'PICKUP_SCHEDULED';
    workshopJobs.push({
      id: did('ws', wsSeq),
      tenantId: T,
      number: docNo('WS', wsSeq),
      bookingId: b.id,
      warehouseId: did('wh', b.cust.city.name === 'Bengaluru' ? 1 : b.cust.city.name === 'Mumbai' ? 2 : 3),
      status: b.ws,
      pickupScheduledAt: b.mode === 'PICKUP_DROP' ? (future ? b.scheduledAt : stamp('PICKUP_SCHEDULED')) : null,
      pickedUpAt: future ? null : stamp('PICKED_UP'),
      receivedAt: future ? null : stamp('RECEIVED_AT_WORKSHOP'),
      estimatedReadyAt: future ? plus(b.scheduledAt, 3 * DAY) : plus(NOW, between(1, 3) * DAY),
      readyAt: stamp('READY_FOR_DELIVERY'),
      outForDeliveryAt: stamp('OUT_FOR_DELIVERY'),
      deliveredAt: stamp('DELIVERED'),
      pickupAgentUserId: b.mode === 'PICKUP_DROP' ? (b.tech?.userId ?? null) : null,
      deliveryAgentUserId: ['OUT_FOR_DELIVERY', 'DELIVERED'].includes(b.ws) ? (b.tech?.userId ?? null) : null,
      benchTechnicianId: future ? null : (techs.find((t) => t.city === b.cust.city.name && t.skills.includes(b.category))?.id ?? b.tech?.id ?? null),
      conditionOnReceipt: future ? null : pick(['Minor scratches on the back panel', 'Good condition, no visible damage', 'Screen has a small crack in the corner (customer informed)']),
      accessoriesReceived: future ? [] : b.category === 'TELEVISION' ? ['Remote', 'Power cable', 'Table stand'] : b.category === 'MICROWAVE' ? ['Glass turntable', 'Roller ring'] : ['Inlet hose'],
      photos: future ? [] : [img('Received')],
      notes: b.ws === 'AWAITING_APPROVAL' ? 'Estimate of ₹3,240 shared with customer, awaiting approval.' : null,
      history: json(
        (future ? ['PICKUP_SCHEDULED' as WorkshopJobStatus] : steps).map((s, i, arr) => ({
          status: s,
          from: i === 0 ? null : arr[i - 1],
          at: (stamp(s) ?? b.createdAt).toISOString(),
          by: i === 0 ? b.createdBy : (b.tech?.userId ?? ctx.dispatcherId),
          note: i === 0 ? 'Workshop job created' : null,
        })),
      ),
      createdAt: b.createdAt,
      createdBy: b.createdBy,
    });
  }

  // --------------------------------------------------------------------------
  // Quotations
  // --------------------------------------------------------------------------
  const quoteTargets = [
    ...bookings.filter((b) => b.status === 'WAITING_PARTS'),
    ...bookings.filter((b) => b.status === 'IN_PROGRESS').slice(0, 1),
    ...bookings.filter((b) => b.status === 'CONFIRMED' && !b.parent).slice(0, 2),
  ];
  const quoteStatuses = ['SENT', 'APPROVED', 'VIEWED', 'REJECTED', 'DRAFT', 'APPROVED', 'EXPIRED'] as const;
  const quotations: Prisma.QuotationCreateManyInput[] = [];
  const quoteLines: Prisma.QuotationLineItemCreateManyInput[] = [];
  quoteTargets.forEach((b, k) => {
    const status = at(quoteStatuses, k);
    const id = did('qtn', k + 1);
    const created = b.waitingPartsAt ?? b.startedAt ?? b.createdAt;
    const parts = partsFor(b.category);
    const ls: LineCalc[] = [];
    if (parts.length > 0) {
      const part = pick(parts);
      ls.push(line(part.s.name, part.s.unit === 'METER' ? 4 : 1, inr(part.s.sell), part.s.hsn));
    }
    ls.push(line(`Labour — ${b.catalogItem.name}`, 1, b.catalogItem.basePriceMinor || inr(499), b.catalogItem.sacCode ?? '998719'));
    if (fam(b.category) === 'AC' && k % 2 === 0) ls.push(line('Gas top-up (R32) as required', 1, inr(1499), '998719'));
    const subtotal = ls.reduce((s, l) => s + l.subtotalMinor, 0);
    const tax = ls.reduce((s, l) => s + l.taxMinor, 0);
    const sentAt = status === 'DRAFT' ? null : plus(created, 20 * MIN);
    quotations.push({
      id,
      tenantId: T,
      number: docNo('QTN', k + 1),
      bookingId: b.id,
      customerId: b.cust.id,
      status,
      expiresAt: status === 'EXPIRED' ? ago(2 * DAY) : plus(created, 7 * DAY),
      sentAt,
      viewedAt: ['VIEWED', 'APPROVED', 'REJECTED'].includes(status) && sentAt ? plus(sentAt, 2 * HOUR) : null,
      approvedAt: status === 'APPROVED' && sentAt ? notFuture(plus(sentAt, 5 * HOUR)) : null,
      rejectedAt: status === 'REJECTED' && sentAt ? notFuture(plus(sentAt, 6 * HOUR)) : null,
      rejectedReason: status === 'REJECTED' ? 'Customer feels compressor replacement is too expensive; will consider buying a new unit.' : null,
      subtotalMinor: subtotal,
      taxMinor: tax,
      totalMinor: subtotal + tax,
      notes: 'Prices include labour. Parts carry 90 days warranty.',
      terms: 'Quote valid for 7 days. 50% advance for parts above ₹5,000.',
      createdAt: created,
    });
    ls.forEach((l, li) => quoteLines.push({ id: did('qtnl', `${k + 1}_${li + 1}`), quotationId: id, ...l, createdAt: created }));
  });

  // --------------------------------------------------------------------------
  // Commissions + payouts
  // --------------------------------------------------------------------------
  const commissions: Prisma.TechnicianCommissionCreateManyInput[] = [];
  const payouts: Prisma.TechnicianPayoutCreateManyInput[] = [];
  const cutoff = ago(8 * DAY);
  const payoutStatusCycle = ['PENDING', 'APPROVED', 'PROCESSING', 'PENDING', 'FAILED', 'PENDING', 'APPROVED', 'PENDING'] as const;
  TECH_SPECS.forEach((s, ti) => {
    const techId = did('tech', s.n);
    const rule = must(commissionRules[ti], 'rule');
    const jobs = bookings.filter((b) => b.tech?.id === techId && b.status === 'COMPLETED' && b.completedAt);
    if (jobs.length === 0) return;
    const oldId = did('payout', `${s.n}_1`);
    const newId = did('payout', `${s.n}_2`);
    const agg = { old: { jobs: 0, gross: 0, bonus: 0 }, new: { jobs: 0, gross: 0, bonus: 0 } };
    for (const b of jobs) {
      const final = bookingMoney.get(b.id)?.final ?? 0;
      const base = rule.type === 'PERCENTAGE' ? Math.round((final * (rule.valueMinor ?? 0)) / 10000) : (rule.valueMinor ?? 0);
      const bonus = rule.bonusMinor ?? 0;
      const isOld = must(b.completedAt, 'done') < cutoff;
      const bucket = isOld ? agg.old : agg.new;
      bucket.jobs += 1;
      bucket.gross += base;
      bucket.bonus += bonus;
      commissions.push({
        id: did('comm', b.n),
        tenantId: T,
        technicianId: techId,
        bookingId: b.id,
        baseMinor: base,
        bonusMinor: bonus,
        netMinor: base + bonus,
        status: isOld ? 'PAID' : 'ACCRUED',
        payoutId: isOld ? oldId : newId,
        ruleSnapshot: json({ type: rule.type, valueMinor: rule.valueMinor, bonusMinor: rule.bonusMinor }),
        createdAt: must(b.completedAt, 'done'),
      });
    }
    const bank = { bankName: pick(['HDFC Bank', 'Canara Bank', 'SBI']), accountLast4: String(between(1000, 9999)), ifsc: 'HDFC0001234' };
    const code = (suffix: string, d: Date) => `PAY-${d.toISOString().slice(0, 7)}-D${String(s.n).padStart(2, '0')}${suffix}`;
    const oldStart = istAt(-46, 0);
    const oldEnd = cutoff;
    payouts.push({
      id: oldId,
      tenantId: T,
      technicianId: techId,
      code: code('A', oldStart),
      periodStart: oldStart,
      periodEnd: oldEnd,
      jobsCount: agg.old.jobs,
      grossMinor: agg.old.gross,
      bonusMinor: agg.old.bonus,
      netMinor: agg.old.gross + agg.old.bonus,
      status: 'PAID',
      paymentRef: `NEFT${between(10000000, 99999999)}`,
      bankDetails: json(bank),
      approvedBy: ctx.adminId,
      approvedAt: plus(oldEnd, DAY),
      paidAt: plus(oldEnd, 2 * DAY),
      createdAt: plus(oldEnd, HOUR),
    });
    const st = at(payoutStatusCycle, ti);
    payouts.push({
      id: newId,
      tenantId: T,
      technicianId: techId,
      code: code('B', cutoff),
      periodStart: cutoff,
      periodEnd: istAt(0, 23, 59),
      jobsCount: agg.new.jobs,
      grossMinor: agg.new.gross,
      bonusMinor: agg.new.bonus,
      netMinor: agg.new.gross + agg.new.bonus,
      status: st,
      bankDetails: json(bank),
      approvedBy: st === 'APPROVED' || st === 'PROCESSING' ? ctx.adminId : null,
      approvedAt: st === 'APPROVED' || st === 'PROCESSING' ? ago(3 * HOUR) : null,
      failureReason: st === 'FAILED' ? 'Beneficiary account name mismatch — bank returned NEFT.' : null,
      createdAt: ago(5 * HOUR),
    });
  });

  // --------------------------------------------------------------------------
  // Support: SLA profiles, tickets, messages, conversations, calls
  // --------------------------------------------------------------------------
  const slaProfiles: Prisma.SLAProfileCreateManyInput[] = [
    {
      id: did('sla', 1),
      tenantId: T,
      name: 'Residential — standard (demo)',
      description: 'Default SLA for home customers: 30 min first response, 8 h resolution.',
      firstResponseMinutes: 30,
      resolutionMinutes: 480,
      priorityOverrides: json({ URGENT: { firstResponseMin: 10, resolutionMin: 120 }, HIGH: { firstResponseMin: 20, resolutionMin: 240 } }),
      isDefault: false,
    },
    {
      id: did('sla', 2),
      tenantId: T,
      name: 'AMC & corporate — priority (demo)',
      description: 'AMC members and B2B accounts.',
      firstResponseMinutes: 15,
      resolutionMinutes: 240,
      businessHoursOnly: true,
      isDefault: false,
    },
  ];
  interface TicketSpec {
    subject: string;
    status: TicketStatus;
    priority: TicketPriority;
    source: TicketSource;
    category: string;
    cust: number | null;
    withBooking?: boolean;
    amc?: boolean;
    hoursAgo: number;
    long?: boolean;
  }
  const ticketSpecs: TicketSpec[] = [
    { subject: 'AC still not cooling after yesterday’s repair', status: 'OPEN', priority: 'HIGH', source: 'WHATSAPP', category: 'service-quality', cust: 2, withBooking: true, hoursAgo: 3 },
    { subject: 'Technician did not arrive in the booked slot', status: 'ESCALATED', priority: 'URGENT', source: 'PHONE', category: 'no-show', cust: 9, withBooking: true, hoursAgo: 7 },
    { subject: 'Invoice shows GST twice — please correct', status: 'PENDING', priority: 'NORMAL', source: 'EMAIL', category: 'billing', cust: 12, withBooking: true, hoursAgo: 26 },
    { subject: 'Need to reschedule AMC visit to next week', status: 'WAITING_CUSTOMER', priority: 'LOW', source: 'IN_APP_CHAT', category: 'amc', cust: 3, amc: true, hoursAgo: 30 },
    { subject: 'Refund for cancelled booking not received', status: 'OPEN', priority: 'HIGH', source: 'EMAIL', category: 'refund', cust: 18, hoursAgo: 50 },
    { subject: 'Water purifier leaking again after filter change', status: 'OPEN', priority: 'NORMAL', source: 'WHATSAPP', category: 'service-quality', cust: 23, withBooking: true, hoursAgo: 5, long: true },
    { subject: 'Is the LG washing machine still under warranty?', status: 'RESOLVED', priority: 'LOW', source: 'WEB_CHAT', category: 'warranty', cust: 27, hoursAgo: 120 },
    { subject: 'Request for GST invoice in company name', status: 'RESOLVED', priority: 'NORMAL', source: 'EMAIL', category: 'billing', cust: 13, hoursAgo: 200 },
    { subject: 'Spare part price seems too high', status: 'ON_HOLD', priority: 'NORMAL', source: 'PHONE', category: 'pricing', cust: 31, withBooking: true, hoursAgo: 72 },
    { subject: 'Rude behaviour by technician', status: 'ESCALATED', priority: 'HIGH', source: 'PHONE', category: 'complaint', cust: 36, withBooking: true, hoursAgo: 20 },
    { subject: 'How do I download my AMC certificate?', status: 'CLOSED', priority: 'LOW', source: 'IN_APP_CHAT', category: 'amc', cust: 7, amc: true, hoursAgo: 400 },
    { subject: 'Pickup for TV repair — when will it be delivered?', status: 'WAITING_CUSTOMER', priority: 'NORMAL', source: 'SMS', category: 'workshop', cust: 1, withBooking: true, hoursAgo: 40 },
    { subject: 'Website chat: price for split AC installation', status: 'PENDING', priority: 'LOW', source: 'WEB_CHAT', category: 'pre-sales', cust: null, hoursAgo: 9 },
    { subject: 'Geyser tripping MCB — urgent, elderly parents at home', status: 'OPEN', priority: 'URGENT', source: 'PHONE', category: 'emergency', cust: 40, hoursAgo: 1 },
    { subject: 'Payment deducted twice via UPI', status: 'PENDING', priority: 'HIGH', source: 'WHATSAPP', category: 'billing', cust: 22, hoursAgo: 15 },
    { subject: 'Feedback: excellent service by Manjunath', status: 'CLOSED', priority: 'LOW', source: 'SOCIAL', category: 'feedback', cust: 5, hoursAgo: 300 },
    { subject: 'Walk-in: microwave dropped for repair', status: 'RESOLVED', priority: 'NORMAL', source: 'WALK_IN', category: 'workshop', cust: 33, hoursAgo: 160 },
    { subject: 'Unable to apply coupon MONSOON20', status: 'RESOLVED', priority: 'LOW', source: 'IN_APP_CHAT', category: 'growth', cust: 16, hoursAgo: 90 },
    { subject: 'Change registered phone number', status: 'WAITING_CUSTOMER', priority: 'LOW', source: 'MANUAL', category: 'account', cust: 44, hoursAgo: 60 },
    { subject: 'Fridge making loud noise after gas charging', status: 'OPEN', priority: 'NORMAL', source: 'WHATSAPP', category: 'service-quality', cust: 28, withBooking: true, hoursAgo: 11 },
  ];
  const tickets: Prisma.SupportTicketCreateManyInput[] = [];
  const ticketMessages: Prisma.TicketMessageCreateManyInput[] = [];
  const ticketActivities: Prisma.TicketActivityCreateManyInput[] = [];
  const conversations: Prisma.ConversationCreateManyInput[] = [];
  const convParticipants: Prisma.ConversationParticipantCreateManyInput[] = [];
  const convMessages: Prisma.ConversationMessageCreateManyInput[] = [];
  const channelFor: Partial<Record<TicketSource, 'WHATSAPP' | 'EMAIL' | 'WEB_CHAT' | 'IN_APP_CHAT' | 'SMS' | 'SOCIAL' | 'PHONE'>> = {
    WHATSAPP: 'WHATSAPP',
    EMAIL: 'EMAIL',
    WEB_CHAT: 'WEB_CHAT',
    IN_APP_CHAT: 'IN_APP_CHAT',
    SMS: 'SMS',
    SOCIAL: 'SOCIAL',
  };
  let convSeq = 0;
  const addConversation = (opts: {
    channel: 'WHATSAPP' | 'EMAIL' | 'WEB_CHAT' | 'IN_APP_CHAT' | 'SMS' | 'SOCIAL' | 'PHONE';
    status: 'OPEN' | 'PENDING' | 'WAITING_CUSTOMER' | 'RESOLVED' | 'CLOSED';
    cust: CustRef | null;
    ticketId: string | null;
    subject: string | null;
    agentId: string | null;
    start: Date;
    messages: { inbound: boolean; body: string }[];
    unread: number;
  }) => {
    convSeq += 1;
    const id = did('conv', convSeq);
    const times = opts.messages.map((_, i) => notFuture(plus(opts.start, i * between(4, 40) * MIN)));
    const lastIn = [...times].reverse().find((_, ri) => opts.messages[opts.messages.length - 1 - ri]?.inbound);
    const lastOut = [...times].reverse().find((_, ri) => !opts.messages[opts.messages.length - 1 - ri]?.inbound);
    conversations.push({
      id,
      tenantId: T,
      ticketId: opts.ticketId,
      channel: opts.channel,
      status: opts.status,
      customerId: opts.cust?.id ?? null,
      anonymousIdentifier: opts.cust ? null : `web-visitor-${alnum(8).toLowerCase()}`,
      externalThreadKey: `demo-thread-${convSeq}`,
      subject: opts.subject,
      assignedAgentId: opts.agentId,
      lastMessageAt: times[times.length - 1] ?? opts.start,
      lastInboundAt: lastIn ?? null,
      lastOutboundAt: lastOut ?? null,
      unreadAgentCount: opts.unread,
      metadata: json({ demo: true }),
      createdAt: opts.start,
    });
    convParticipants.push({ id: did('cpart', `${convSeq}_c`), tenantId: T, conversationId: id, kind: 'CUSTOMER', userId: opts.cust?.userId ?? null, displayName: opts.cust?.name ?? 'Website visitor', joinedAt: opts.start });
    if (opts.agentId) convParticipants.push({ id: did('cpart', `${convSeq}_a`), tenantId: T, conversationId: id, kind: 'AGENT', userId: opts.agentId, joinedAt: plus(opts.start, 2 * MIN), lastReadAt: lastOut ?? null });
    opts.messages.forEach((m, i) => {
      const t = times[i] ?? opts.start;
      convMessages.push({
        id: did('cmsg', `${convSeq}_${i + 1}`),
        tenantId: T,
        conversationId: id,
        direction: m.inbound ? 'INBOUND' : 'OUTBOUND',
        authorKind: m.inbound ? 'CUSTOMER' : 'AGENT',
        authorUserId: m.inbound ? (opts.cust?.userId ?? null) : opts.agentId,
        body: m.body,
        channel: opts.channel,
        status: m.inbound ? 'DELIVERED' : i === opts.messages.length - 1 ? 'DELIVERED' : 'READ',
        sentAt: t,
        deliveredAt: plus(t, 3_000),
        readAt: m.inbound || i === opts.messages.length - 1 ? null : plus(t, 2 * MIN),
        createdAt: t,
      });
    });
  };
  ticketSpecs.forEach((s, k) => {
    const n = k + 1;
    const id = did('tkt', n);
    const cust = s.cust ? at(customers, s.cust - 1) : null;
    const booking = s.withBooking && cust ? (bookings.find((b) => b.cust.id === cust.id && b.status === 'COMPLETED') ?? bookings.find((b) => b.cust.id === cust.id) ?? null) : null;
    const amc = s.amc && cust ? amcSubs.find((a) => a.customerId === cust.id) : undefined;
    const createdAt = ago(s.hoursAgo * HOUR);
    const firstMin = s.priority === 'URGENT' ? 10 : s.priority === 'HIGH' ? 20 : 30;
    const resMin = s.priority === 'URGENT' ? 120 : s.priority === 'HIGH' ? 240 : 480;
    const agent = s.status === 'OPEN' && k % 3 === 0 ? null : at([...agentIds, ctx.adminId], k);
    const responded = agent !== null && !(s.status === 'OPEN' && k % 2 === 0);
    const firstResponseAt = responded ? notFuture(plus(createdAt, between(4, firstMin + 25) * MIN)) : null;
    const resolved = s.status === 'RESOLVED' || s.status === 'CLOSED';
    const resolvedAt = resolved ? plus(createdAt, between(2, 30) * HOUR) : null;
    tickets.push({
      id,
      tenantId: T,
      number: docNo('TKT', n),
      customerId: cust?.id ?? null,
      anonymousIdentifier: cust ? null : `web-visitor-${alnum(8).toLowerCase()}`,
      bookingId: booking?.id ?? null,
      amcSubscriptionId: amc?.id ?? null,
      subject: s.subject,
      description: s.long
        ? `${LONG_ISSUE}\n\nAdditionally: the purifier was serviced on the 2nd and the technician replaced the sediment and carbon filters, but since then there is a slow drip from the bottom left corner and the floor is wet every morning. I have attached photos. Please send someone who can check the fittings properly this time — I do not want to pay another visit charge.`
        : `${s.subject}. ${cust ? `Customer ${cust.name} (${cust.city.name}).` : 'Anonymous website visitor.'}`,
      status: s.status,
      priority: s.priority,
      source: s.source,
      category: s.category,
      subcategory: s.category === 'billing' ? 'invoice-correction' : null,
      tags: [s.category, ...(s.priority === 'URGENT' ? ['urgent'] : []), ...(amc ? ['amc'] : [])],
      assignedAgentId: agent,
      assignedTeam: s.category === 'billing' || s.category === 'refund' ? 'billing' : s.category === 'amc' ? 'amc-team' : s.status === 'ESCALATED' ? 'field-ops' : 'tier1',
      slaProfileId: amc ? did('sla', 2) : did('sla', 1),
      firstResponseDueAt: plus(createdAt, firstMin * MIN),
      resolutionDueAt: plus(createdAt, resMin * MIN),
      firstResponseAt,
      firstResponseRecorded: !!firstResponseAt,
      resolvedAt,
      closedAt: s.status === 'CLOSED' && resolvedAt ? plus(resolvedAt, DAY) : null,
      satisfactionRating: resolved ? pick([5, 4, 5, 3]) : null,
      csatComment: resolved && k % 2 === 0 ? 'Quick resolution, thanks!' : null,
      escalationLevel: s.status === 'ESCALATED' ? (s.priority === 'URGENT' ? 2 : 1) : 0,
      escalatedAt: s.status === 'ESCALATED' ? plus(createdAt, 90 * MIN) : null,
      metadata: json({ demo: true }),
      createdAt,
      createdBy: s.source === 'PHONE' || s.source === 'MANUAL' || s.source === 'WALK_IN' ? (agent ?? ctx.adminId) : null,
    });
    const msgs: { kind: 'CUSTOMER' | 'AGENT' | 'SYSTEM'; body: string; internal?: boolean }[] = [
      { kind: 'CUSTOMER', body: s.long ? 'Purifier is leaking again, floor is wet every morning. Photos attached.' : `Hi, ${s.subject.toLowerCase()}. Please help.` },
    ];
    if (firstResponseAt) msgs.push({ kind: 'AGENT', body: `Hello${cust ? ` ${cust.name.split(' ')[0]}` : ''}, sorry for the trouble. I am checking this for you right away.` });
    if (k % 2 === 0 && agent) msgs.push({ kind: 'AGENT', body: 'Checked job card — technician noted low gas pressure. Scheduling a free revisit.', internal: true });
    if (s.status === 'WAITING_CUSTOMER') msgs.push({ kind: 'AGENT', body: 'Could you please share a convenient date and time for the visit?' });
    if (resolved) msgs.push({ kind: 'AGENT', body: 'This has been resolved. Please reply if you need anything else.' }, { kind: 'SYSTEM', body: 'Ticket marked as resolved.' });
    if (s.status === 'ESCALATED') msgs.push({ kind: 'SYSTEM', body: 'SLA breached — escalated to supervisor.' });
    msgs.forEach((m, i) => {
      ticketMessages.push({
        id: did('tmsg', `${n}_${i + 1}`),
        tenantId: T,
        ticketId: id,
        authorKind: m.kind,
        authorUserId: m.kind === 'AGENT' ? agent : m.kind === 'CUSTOMER' ? (cust?.userId ?? null) : null,
        body: m.body,
        isInternal: m.internal ?? false,
        channel: m.internal || m.kind === 'SYSTEM' ? null : (channelFor[s.source] ?? null),
        createdAt: notFuture(plus(createdAt, i * between(5, 50) * MIN)),
      });
    });
    let a = 0;
    const tact = (type: Prisma.TicketActivityCreateManyInput['type'], when: Date, message: string, extra: Partial<Prisma.TicketActivityCreateManyInput> = {}) =>
      ticketActivities.push({ id: did('tact', `${n}_${++a}`), tenantId: T, ticketId: id, type, message, createdAt: notFuture(when), ...extra });
    tact('CREATED', createdAt, `Ticket created via ${s.source.toLowerCase().replace('_', ' ')}`, { toStatus: 'OPEN' });
    if (agent) tact('ASSIGNED', plus(createdAt, 3 * MIN), 'Assigned to agent', { actorUserId: ctx.adminId });
    if (firstResponseAt) tact('REPLY_SENT', firstResponseAt, 'First response sent', { actorUserId: agent });
    if (s.status !== 'OPEN' && !resolved) tact('STATUS_CHANGED', plus(createdAt, 40 * MIN), `Status changed to ${s.status}`, { fromStatus: 'OPEN', toStatus: s.status, actorUserId: agent });
    if (s.status === 'ESCALATED') tact('SLA_BREACHED', plus(createdAt, resMin * MIN), 'Resolution SLA breached', {});
    if (resolvedAt) tact('RESOLVED', resolvedAt, 'Ticket resolved', { fromStatus: 'OPEN', toStatus: 'RESOLVED', actorUserId: agent });
    if (s.status === 'CLOSED' && resolvedAt) tact('CLOSED', plus(resolvedAt, DAY), 'Ticket closed', { fromStatus: 'RESOLVED', toStatus: 'CLOSED' });
    const channel = channelFor[s.source];
    if (channel) {
      addConversation({
        channel,
        status: resolved ? (s.status === 'CLOSED' ? 'CLOSED' : 'RESOLVED') : s.status === 'WAITING_CUSTOMER' ? 'WAITING_CUSTOMER' : s.status === 'PENDING' ? 'PENDING' : 'OPEN',
        cust,
        ticketId: id,
        subject: s.subject,
        agentId: agent,
        start: createdAt,
        messages: msgs.filter((m) => !m.internal && m.kind !== 'SYSTEM').map((m) => ({ inbound: m.kind === 'CUSTOMER', body: m.body })),
        unread: resolved ? 0 : firstResponseAt ? 0 : 1,
      });
    }
  });
  // Standalone inbox threads (no ticket yet).
  [
    { cust: 4, ch: 'WHATSAPP' as const, msgs: ['Hi, do you service Daikin inverter ACs?', 'Yes, we do! Would you like to book a service?', 'Ok what is the price for 2 ACs?'], unread: 1 },
    { cust: 17, ch: 'WHATSAPP' as const, msgs: ['Technician is outside, he is asking for OTP. Where do I find it?'], unread: 1 },
    { cust: 34, ch: 'EMAIL' as const, msgs: ['Please share the invoice for last month’s washing machine repair for my office reimbursement.', 'Sure — attached the invoice PDF. Let us know if you need it in a different name.'], unread: 0 },
    { cust: 43, ch: 'SMS' as const, msgs: ['STOP'], unread: 1 },
  ].forEach((t, i) => {
    const cust = at(customers, t.cust - 1);
    addConversation({
      channel: t.ch,
      status: t.unread ? 'OPEN' : 'RESOLVED',
      cust,
      ticketId: null,
      subject: null,
      agentId: t.msgs.length > 1 ? at(agentIds, i) : null,
      start: ago(between(20, 600) * MIN),
      messages: t.msgs.map((body, mi) => ({ inbound: mi % 2 === 0, body })),
      unread: t.unread,
    });
  });

  const callLogs: Prisma.CallLogCreateManyInput[] = [];
  const COMPANY_LINE = '+918041234567';
  const callSpecs: { dir: 'INBOUND' | 'OUTBOUND'; status: Prisma.CallLogCreateManyInput['status']; cust: number | null; disp?: Prisma.CallLogCreateManyInput['disposition']; mins: number; hoursAgo: number; ticket?: number; notes?: string }[] = [
    { dir: 'INBOUND', status: 'COMPLETED', cust: 9, disp: 'COMPLAINT', mins: 6, hoursAgo: 7, ticket: 2, notes: 'Customer upset — technician did not show up. Escalated.' },
    { dir: 'INBOUND', status: 'MISSED', cust: null, mins: 0, hoursAgo: 2 },
    { dir: 'OUTBOUND', status: 'COMPLETED', cust: 9, disp: 'CALLBACK_REQUESTED', mins: 3, hoursAgo: 6, ticket: 2 },
    { dir: 'INBOUND', status: 'COMPLETED', cust: 40, disp: 'BOOKING_CREATED', mins: 4, hoursAgo: 1, ticket: 14, notes: 'Emergency geyser booking created for today.' },
    { dir: 'INBOUND', status: 'ABANDONED', cust: 25, mins: 0, hoursAgo: 28 },
    { dir: 'OUTBOUND', status: 'NO_ANSWER', cust: 31, mins: 0, hoursAgo: 50 },
    { dir: 'INBOUND', status: 'COMPLETED', cust: 36, disp: 'COMPLAINT', mins: 9, hoursAgo: 20, ticket: 10 },
    { dir: 'INBOUND', status: 'VOICEMAIL', cust: null, mins: 1, hoursAgo: 14 },
    { dir: 'OUTBOUND', status: 'COMPLETED', cust: 3, disp: 'RESOLVED', mins: 2, hoursAgo: 30 },
    { dir: 'INBOUND', status: 'COMPLETED', cust: null, disp: 'WRONG_NUMBER', mins: 1, hoursAgo: 75 },
    { dir: 'OUTBOUND', status: 'BUSY', cust: 44, mins: 0, hoursAgo: 60 },
    { dir: 'INBOUND', status: 'COMPLETED', cust: 20, disp: 'FOLLOWUP_NEEDED', mins: 5, hoursAgo: 4, notes: 'Wants quote for 3 ACs AMC; send by evening.' },
    { dir: 'INBOUND', status: 'MISSED', cust: 12, mins: 0, hoursAgo: 1 },
  ];
  callSpecs.forEach((c, k) => {
    const cust = c.cust ? at(customers, c.cust - 1) : null;
    const other = cust?.phone ?? demoPhone(5000 + k);
    const start = ago(c.hoursAgo * HOUR + between(0, 50) * MIN);
    const answered = c.status === 'COMPLETED';
    const agent = c.status === 'MISSED' || c.status === 'ABANDONED' ? null : at(agentIds, k);
    callLogs.push({
      id: did('call', k + 1),
      tenantId: T,
      number: docNo('CALL', k + 1),
      direction: c.dir,
      status: c.status,
      customerId: cust?.id ?? null,
      fromNumber: c.dir === 'INBOUND' ? other : COMPANY_LINE,
      toNumber: c.dir === 'INBOUND' ? COMPANY_LINE : other,
      agentUserId: agent,
      ticketId: c.ticket ? did('tkt', c.ticket) : null,
      provider: 'exotel',
      externalCallId: `demo-call-${k + 1}`,
      queue: c.dir === 'INBOUND' ? pick(['support-en', 'support-hi', 'bookings']) : null,
      startedAt: start,
      answeredAt: answered ? plus(start, between(5, 30) * 1000) : null,
      endedAt: plus(start, (c.mins * 60 + between(10, 50)) * 1000),
      durationS: answered ? c.mins * 60 + between(5, 55) : c.status === 'VOICEMAIL' ? 42 : 0,
      disposition: c.disp ?? null,
      dispositionNotes: c.notes ?? null,
      recordingUrl: answered ? `https://recordings.example/demo/${k + 1}.mp3` : null,
      metadata: json({ demo: true }),
      createdAt: start,
      createdBy: agent,
    });
  });

  // --------------------------------------------------------------------------
  // Knowledge base + canned responses
  // --------------------------------------------------------------------------
  const kbCats: Prisma.KnowledgeBaseCategoryCreateManyInput[] = [
    { id: did('kbc', 1), tenantId: T, slug: 'air-conditioners', name: 'Air conditioners', description: 'Troubleshooting, servicing and installation guides for split and window ACs.', ordering: 1 },
    { id: did('kbc', 2), tenantId: T, slug: 'refrigerators-washing-machines', name: 'Refrigerators & washing machines', description: 'Common faults and care tips.', ordering: 2 },
    { id: did('kbc', 3), tenantId: T, slug: 'water-purifiers', name: 'Water purifiers', description: 'RO/UV maintenance and filter schedules.', ordering: 3 },
    { id: did('kbc', 4), tenantId: T, slug: 'billing-payments', name: 'Billing & payments', description: 'Invoices, GST, refunds and payment methods.', ordering: 4 },
    { id: did('kbc', 5), tenantId: T, slug: 'amc-plans', name: 'AMC plans', description: 'Annual maintenance contracts explained.', ordering: 5 },
    { id: did('kbc', 6), tenantId: T, slug: 'technician-sop', name: 'Technician SOPs (internal)', description: 'Internal standard operating procedures.', ordering: 6, isPublic: false },
  ];
  const kbArticles: Prisma.KnowledgeBaseArticleCreateManyInput[] = [
    ['ac-not-cooling-checklist', 'AC not cooling? 6 things to check before booking a technician', 1, 'PUBLISHED', 'PUBLIC', ['ac', 'troubleshooting']],
    ['how-often-service-split-ac', 'How often should a split AC be serviced in Indian weather?', 1, 'PUBLISHED', 'PUBLIC', ['ac', 'maintenance']],
    ['ac-error-codes-daikin-lg-voltas', 'Decoding common error codes on Daikin, LG and Voltas ACs', 1, 'PUBLISHED', 'PUBLIC', ['ac', 'error-codes']],
    ['fridge-ice-buildup', 'Why is ice building up in my frost-free refrigerator?', 2, 'PUBLISHED', 'PUBLIC', ['refrigerator']],
    ['washing-machine-oe-error', 'Front-load washer showing OE / drain error', 2, 'PUBLISHED', 'PUBLIC', ['washing-machine', 'lg']],
    ['ro-filter-change-schedule', 'When to change RO filters and membrane', 3, 'PUBLISHED', 'PUBLIC', ['ro', 'filters']],
    ['gst-invoice-company-name', 'Getting a GST invoice in your company’s name', 4, 'PUBLISHED', 'CUSTOMER_AUTHENTICATED', ['billing', 'gst']],
    ['refund-timelines', 'Refund timelines for cancelled bookings', 4, 'DRAFT', 'PUBLIC', ['refund']],
    ['amc-what-is-covered', 'What does the AMC Standard plan cover?', 5, 'PUBLISHED', 'PUBLIC', ['amc']],
    ['sop-r32-gas-charging', 'SOP: R32 gas charging and leak testing', 6, 'PUBLISHED', 'INTERNAL', ['sop', 'ac', 'safety']],
    ['old-monsoon-offer-2025', 'Monsoon offer 2025 — terms (archived)', 4, 'ARCHIVED', 'PUBLIC', ['offer']],
  ].map(([slug, title, cat, status, visibility, tags], i) => ({
    id: did('kba', i + 1),
    tenantId: T,
    categoryId: did('kbc', cat as number),
    slug: slug as string,
    title: title as string,
    bodyMarkdown: `# ${title as string}\n\nThis guide walks you through the most common causes and what you can safely check yourself.\n\n## Quick checks\n\n1. Make sure the unit is powered on and the MCB has not tripped.\n2. Clean or replace filters if they look dusty.\n3. Check that the remote/settings are correct (mode, temperature).\n\n## When to call us\n\nIf the problem persists after these checks, book a visit from the app. Our technicians carry common spare parts and every repair comes with a service warranty.\n\n> Tip: keep your appliance model number handy — it is printed on the sticker on the side of the unit.`,
    excerpt: `Practical tips: ${(title as string).toLowerCase()}.`,
    status: status as 'PUBLISHED' | 'DRAFT' | 'ARCHIVED',
    visibility: visibility as 'PUBLIC' | 'INTERNAL' | 'CUSTOMER_AUTHENTICATED',
    authorUserId: i % 2 === 0 ? ctx.adminId : did('user', 's01'),
    tags: tags as string[],
    viewCount: status === 'PUBLISHED' ? between(40, 2400) : 0,
    helpfulCount: status === 'PUBLISHED' ? between(5, 180) : 0,
    notHelpfulCount: status === 'PUBLISHED' ? between(0, 20) : 0,
    publishedAt: status === 'DRAFT' ? null : ago(between(10, 180) * DAY),
    createdAt: ago(between(20, 200) * DAY),
  }));
  const canned: Prisma.CannedResponseCreateManyInput[] = [
    ['greeting', 'Greeting', 'Hi {{customerName}}, thanks for reaching out to us! How can I help you today?', ['WHATSAPP', 'WEB_CHAT', 'IN_APP_CHAT'], ['general']],
    ['ask-otp', 'Share booking OTP', 'Please share the 4-digit OTP sent to your phone with the technician when they arrive. This confirms the visit.', ['WHATSAPP', 'SMS', 'IN_APP_CHAT'], ['booking']],
    ['reschedule-confirmed', 'Reschedule confirmed', 'Your booking {{code}} has been rescheduled to {{scheduledAt}}. The technician will call 30 minutes before arriving.', ['WHATSAPP', 'SMS', 'EMAIL'], ['booking']],
    ['invoice-resend', 'Resend invoice', 'Please find your invoice {{number}} attached. You can also download it anytime from the app under My Bookings.', ['EMAIL', 'WHATSAPP'], ['billing']],
    ['refund-initiated', 'Refund initiated', 'We have initiated a refund of ₹{{amount}}. It should reflect in your account within 5–7 working days.', ['EMAIL', 'WHATSAPP', 'SMS'], ['billing', 'refund']],
    ['warranty-revisit', 'Free warranty revisit', 'Sorry the issue came back! Your repair is under our service warranty, so the revisit is free. Booking it now.', ['WHATSAPP', 'IN_APP_CHAT'], ['warranty']],
    ['amc-upsell', 'AMC upsell', 'Did you know our AMC Standard plan includes 4 visits a year and 10% off repairs? Reply YES to know more.', ['WHATSAPP'], ['amc', 'sales']],
    ['closing', 'Closing message', 'Glad we could help! If you have a minute, please rate your experience in the app. Have a great day.', ['WHATSAPP', 'WEB_CHAT', 'IN_APP_CHAT', 'EMAIL'], ['general']],
  ].map(([code, title, body, channels, tags], i) => ({
    id: did('canned', i + 1),
    tenantId: T,
    code: code as string,
    title: title as string,
    body: body as string,
    channels: channels as ('WHATSAPP' | 'EMAIL' | 'WEB_CHAT' | 'IN_APP_CHAT' | 'SMS')[],
    scope: i === 6 ? 'TEAM' : 'GLOBAL',
    team: i === 6 ? 'sales' : null,
    tags: tags as string[],
    usageCount: between(3, 420),
    createdAt: ago(between(30, 200) * DAY),
  }));

  // --------------------------------------------------------------------------
  // Warranty claims
  // --------------------------------------------------------------------------
  const revisits = bookings.filter((b) => b.parent);
  const oemAppliances = customers.flatMap((c) => c.appliances.map((a) => ({ c, a }))).filter(({ a }) => a.warrantyUntil && a.warrantyUntil > NOW);
  const warrantyClaims: Prisma.WarrantyClaimCreateManyInput[] = [];
  revisits.forEach((r, k) => {
    const parent = must(r.parent, 'parent');
    const status = k === 0 ? 'CLOSED' : 'APPROVED';
    warrantyClaims.push({
      id: did('wc', k + 1),
      tenantId: T,
      number: docNo('WC', k + 1),
      type: 'REPAIR_REVISIT',
      status,
      customerId: r.cust.id,
      applianceId: r.appliance.id,
      originalBookingId: parent.id,
      revisitBookingId: r.id,
      reason: 'Same fault recurred within repair warranty',
      description: r.issue,
      decidedAt: plus(r.createdAt, -30 * MIN),
      decidedBy: ctx.adminId,
      decisionNotes: 'Within repair warranty window — free revisit approved.',
      createdAt: plus(r.createdAt, -2 * HOUR),
      createdBy: did('user', 's01'),
    });
  });
  const oemSpecs = [
    { status: 'SUBMITTED_TO_OEM' as const, reason: 'Drum bearing failure within manufacturer warranty', claim: 4500, settled: 0, ref: 'LGSVC-2026-448812' },
    { status: 'SETTLED' as const, reason: 'Compressor replaced under manufacturer warranty', claim: 6800, settled: 6200, ref: 'SAM-WTY-9921034' },
    { status: 'REJECTED' as const, reason: 'PCB failure — OEM rejected (physical/water damage found)', claim: 5200, settled: 0, ref: 'DKN-CLM-55120' },
    { status: 'OPEN' as const, reason: 'Panel lines on TV within 1-year warranty', claim: 9800, settled: 0, ref: null },
  ];
  oemSpecs.forEach((s, k) => {
    const { c, a } = at(oemAppliances, k * 3 + 1);
    const n = revisits.length + k + 1;
    const created = ago(between(4, 30) * DAY);
    warrantyClaims.push({
      id: did('wc', n),
      tenantId: T,
      number: docNo('WC', n),
      type: 'OEM_CLAIM',
      status: s.status,
      customerId: c.id,
      applianceId: a.id,
      originalBookingId: bookings.find((b) => b.appliance.id === a.id)?.id ?? null,
      reason: s.reason,
      description: `${a.brand} ${a.model} (${a.capacity}). Warranty valid until ${a.warrantyUntil?.toISOString().slice(0, 10) ?? 'n/a'}.`,
      oemName: a.brand,
      oemClaimRef: s.ref,
      claimAmountMinor: inr(s.claim),
      settledAmountMinor: inr(s.settled),
      decidedAt: s.status === 'OPEN' ? null : plus(created, 2 * DAY),
      decidedBy: s.status === 'OPEN' ? null : ctx.adminId,
      decisionNotes: s.status === 'REJECTED' ? 'OEM inspection report shows liquid ingress on PCB.' : null,
      createdAt: created,
      createdBy: ctx.adminId,
    });
  });

  // --------------------------------------------------------------------------
  // Inventory: stock, ledger, POs, GRNs, transfers, van stock, alerts
  // --------------------------------------------------------------------------
  const stocks: Prisma.WarehouseStockCreateManyInput[] = [];
  const stockQty = new Map<string, number>();
  const lowStocks: { stockId: string; itemId: string; whId: string; qty: number; reorder: number; name: string; whName: string }[] = [];
  ITEM_SPECS.forEach((s, ii) => {
    warehouses.forEach((w, wi) => {
      const whId = must(w.id, 'wh');
      const itemId = did('item', ii + 1);
      const reorder = wi === 0 ? s.reorder : Math.max(1, Math.round(s.reorder / 2));
      let qty = wi === 0 ? between(reorder + 2, reorder * 4 + 5) : between(Math.max(0, reorder - 1), reorder * 3);
      const k = ii * 3 + wi;
      if (k % 13 === 4) qty = 0; // out of stock
      else if (k % 11 === 2) qty = Math.max(1, reorder - between(1, 3)); // low stock
      const stockId = did('stk', `${ii + 1}_${wi + 1}`);
      stocks.push({
        id: stockId,
        tenantId: T,
        warehouseId: whId,
        itemId,
        zoneId: did('zone', `${wi + 1}${s.category === 'Refrigerant' ? 'A' : ['PCB', 'Capacitor', 'Motor', 'Sensor', 'Electrical', 'Backlight', 'Battery', 'Magnetron'].includes(s.category) ? 'B' : 'C'}`),
        quantity: qty,
        reservedQuantity: qty > 3 && k % 5 === 0 ? between(1, 2) : 0,
        reorderLevel: reorder,
        reorderQty: reorder * 2,
        avgCostMinor: inr(s.cost),
        lastMovementAt: ago(between(1, k % 17 === 0 ? 120 : 20) * DAY),
        earliestExpiryAt: s.category === 'Refrigerant' ? plus(NOW, between(90, 700) * DAY) : null,
      });
      stockQty.set(`${itemId}|${whId}`, qty);
      if (qty < reorder) lowStocks.push({ stockId, itemId, whId, qty, reorder, name: s.name, whName: must(w.name, 'wh name') });
    });
  });

  const pos: Prisma.PurchaseOrderCreateManyInput[] = [];
  const poItems: Prisma.PurchaseOrderItemCreateManyInput[] = [];
  const grns: Prisma.GoodsReceiptCreateManyInput[] = [];
  const grnItems: Prisma.GoodsReceiptItemCreateManyInput[] = [];
  const receivedIn: { itemId: string; whId: string; qty: number; cost: number; at: Date; poId: string; grnId: string }[] = [];
  const poSpecs: { status: Prisma.PurchaseOrderCreateManyInput['status']; vendor: number; wh: number; daysAgo: number; skus: [string, number][] }[] = [
    { status: 'DRAFT', vendor: 1, wh: 1, daysAgo: 1, skus: [['ACR-GAS-R32-1KG', 40], ['ACR-CAP-35MFD', 50]] },
    { status: 'AWAITING_APPROVAL', vendor: 4, wh: 1, daysAgo: 2, skus: [['RO-MEMBRANE-80G', 30], ['RO-SEDIMENT-10', 100], ['RO-CARBON-PRE', 80]] },
    { status: 'ORDERED', vendor: 2, wh: 2, daysAgo: 12, skus: [['ACR-PCB-LG-DUAL', 4], ['ACR-THERM-10K', 40]] },
    { status: 'PARTIALLY_RECEIVED', vendor: 1, wh: 1, daysAgo: 9, skus: [['ACR-FANMTR-IDU', 10], ['ACR-FANMTR-ODU', 8], ['ACR-COPPER-14', 120]] },
    { status: 'RECEIVED', vendor: 4, wh: 3, daysAgo: 20, skus: [['WM-DRAINPUMP-LG', 6], ['WM-INLET-VALVE', 10], ['FRG-RELAY-OLP', 20]] },
    { status: 'CANCELLED', vendor: 3, wh: 3, daysAgo: 25, skus: [['TV-LEDSTRIP-43', 10]] },
    { status: 'CLOSED', vendor: 1, wh: 1, daysAgo: 40, skus: [['ACR-GAS-R410A-1KG', 25], ['ACR-DRAIN-16MM', 200]] },
  ];
  let grnSeq = 0;
  poSpecs.forEach((p, k) => {
    const id = did('po', k + 1);
    const created = ago(p.daysAgo * DAY);
    const whId = did('wh', p.wh);
    const vendor = must(vendorSpecs[p.vendor - 1], 'vendor');
    let subtotal = 0;
    let tax = 0;
    const lines = p.skus.map(([sku, qty], li) => {
      const { id: itemId, spec } = itemBySku(sku);
      const cost = inr(spec.cost);
      const lineTax = Math.round((qty * cost * 1800) / 10000);
      subtotal += qty * cost;
      tax += lineTax;
      const received = p.status === 'RECEIVED' || p.status === 'CLOSED' ? qty : p.status === 'PARTIALLY_RECEIVED' ? (li === 0 ? qty : li === 1 ? Math.floor(qty / 2) : 0) : 0;
      poItems.push({ id: did('poi', `${k + 1}_${li + 1}`), purchaseOrderId: id, itemId, description: spec.name, quantity: qty, receivedQty: received, unitCostMinor: cost, gstRateBps: 1800, taxMinor: lineTax, totalMinor: qty * cost + lineTax, createdAt: created });
      return { itemId, qty: received, cost };
    });
    const shipping = p.status === 'DRAFT' ? 0 : inr(pick([0, 250, 500]));
    const approved = !['DRAFT', 'AWAITING_APPROVAL'].includes(p.status ?? 'DRAFT');
    const receivedAt = p.status === 'RECEIVED' || p.status === 'CLOSED' ? plus(created, 5 * DAY) : null;
    pos.push({
      id,
      tenantId: T,
      number: docNo('PO', k + 1),
      vendorId: did('ven', p.vendor),
      warehouseId: whId,
      status: p.status,
      expectedAt: plus(created, (k === 2 ? 5 : 7) * DAY),
      orderedAt: approved ? plus(created, 4 * HOUR) : null,
      receivedAt,
      closedAt: p.status === 'CANCELLED' || p.status === 'CLOSED' ? plus(created, 6 * DAY) : null,
      subtotalMinor: subtotal,
      taxMinor: tax,
      shippingMinor: shipping,
      totalMinor: subtotal + tax + shipping,
      paymentTermsDays: vendor.terms,
      notes: p.status === 'CANCELLED' ? 'Cancelled — vendor on hold after repeated delays.' : k === 2 ? 'Vendor promised dispatch by Friday. Follow up.' : null,
      approvedById: approved ? ctx.adminId : null,
      approvedAt: approved ? plus(created, 3 * HOUR) : null,
      createdAt: created,
      createdBy: ctx.dispatcherId,
    });
    if (p.status === 'RECEIVED' || p.status === 'CLOSED' || p.status === 'PARTIALLY_RECEIVED') {
      grnSeq += 1;
      const grnId = did('grn', grnSeq);
      const at2 = receivedAt ?? plus(created, 4 * DAY);
      grns.push({ id: grnId, tenantId: T, number: docNo('GRN', grnSeq), purchaseOrderId: id, warehouseId: whId, status: 'POSTED', receivedAt: at2, notes: p.status === 'PARTIALLY_RECEIVED' ? 'Balance quantity on back-order.' : null, attachments: [img('Delivery challan')], createdAt: at2, createdBy: ctx.dispatcherId });
      lines.forEach((l, li) => {
        if (l.qty <= 0) return;
        grnItems.push({ id: did('grni', `${grnSeq}_${li + 1}`), goodsReceiptId: grnId, itemId: l.itemId, quantity: l.qty, unitCostMinor: l.cost, batchNumber: `B${YEAR}${String(k + 1).padStart(2, '0')}${li + 1}`, serialNumbers: [], createdAt: at2 });
        receivedIn.push({ itemId: l.itemId, whId, qty: l.qty, cost: l.cost, at: at2, poId: id, grnId });
      });
    }
  });

  const transfers: Prisma.StockTransferCreateManyInput[] = [
    { id: did('trn', 1), tenantId: T, number: docNo('TRN', 1), sourceWarehouseId: did('wh', 1), destWarehouseId: did('wh', 2), status: 'IN_TRANSIT', requestedAt: ago(3 * DAY), approvedAt: ago(70 * HOUR), dispatchedAt: ago(2 * DAY), notes: 'Mumbai branch running low on capacitors before festive season.', requestedBy: did('user', 's03'), approvedBy: ctx.adminId, createdAt: ago(3 * DAY) },
    { id: did('trn', 2), tenantId: T, number: docNo('TRN', 2), sourceWarehouseId: did('wh', 1), destWarehouseId: did('wh', 3), status: 'RECEIVED', requestedAt: ago(15 * DAY), approvedAt: ago(14 * DAY), dispatchedAt: ago(13 * DAY), receivedAt: ago(11 * DAY), notes: 'Monthly replenishment — Delhi.', requestedBy: did('user', 's03'), approvedBy: ctx.adminId, receivedBy: did('user', 's03'), createdAt: ago(15 * DAY) },
    { id: did('trn', 3), tenantId: T, number: docNo('TRN', 3), sourceWarehouseId: did('wh', 2), destWarehouseId: did('wh', 1), status: 'REQUESTED', requestedAt: ago(5 * HOUR), notes: 'Return slow-moving R22 cans to central.', requestedBy: did('user', 's03'), createdAt: ago(5 * HOUR) },
  ];
  const transferItems: Prisma.StockTransferItemCreateManyInput[] = [];
  const transferMoves: { itemId: string; from: string; to: string | null; qty: number; at: Date; transferId: string }[] = [];
  ([
    [1, 'ACR-CAP-35MFD', 20, 20, 0],
    [1, 'ACR-CAP-45MFD', 15, 15, 0],
    [2, 'GEY-ELEMENT-2KW', 10, 10, 10],
    [2, 'ACR-GAS-R32-1KG', 12, 12, 11],
    [3, 'ACR-GAS-R22-1KG', 4, 0, 0],
  ] as [number, string, number, number, number][]).forEach(([t, sku, req, disp, recv], i) => {
    const { id: itemId, spec } = itemBySku(sku);
    transferItems.push({ id: did('trni', i + 1), transferId: did('trn', t), itemId, requestedQty: req, dispatchedQty: disp, receivedQty: recv, unitCostMinor: inr(spec.cost), notes: t === 2 && recv < disp ? '1 can damaged in transit' : null });
    const tr = must(transfers[t - 1], 'transfer');
    if (disp > 0) transferMoves.push({ itemId, from: tr.sourceWarehouseId, to: recv > 0 ? tr.destWarehouseId : null, qty: disp, at: ago((t === 1 ? 2 : 13) * DAY), transferId: did('trn', t) });
  });

  const vanStock: Prisma.TechnicianInventoryCreateManyInput[] = [];
  TECH_SPECS.forEach((s, ti) => {
    const techId = did('tech', s.n);
    const wh = did('wh', s.city === 'Bengaluru' ? 1 : s.city === 'Mumbai' ? 2 : 3);
    const candidates = ITEM_SPECS.map((x, i) => ({ x, i })).filter(({ x }) => x.type !== 'TOOL' && x.cats.some((c) => s.skills.includes(c)));
    for (let j = 0; j < 3 && j < candidates.length; j++) {
      const { x, i } = at(candidates, ti + j * 2);
      const status = at(['ALLOCATED', 'ACKNOWLEDGED', 'USED', 'RETURNED', 'ACKNOWLEDGED'] as const, ti + j);
      const qty = x.unit === 'METER' ? 10 : between(2, 6);
      const allocatedAt = ago(between(1, 14) * DAY);
      vanStock.push({
        id: did('van', `${s.n}_${j + 1}`),
        tenantId: T,
        technicianId: techId,
        itemId: did('item', i + 1),
        sourceWarehouseId: wh,
        status,
        allocatedQty: qty,
        usedQty: status === 'USED' ? Math.max(1, qty - 1) : 0,
        returnedQty: status === 'RETURNED' ? qty : 0,
        unitCostMinor: inr(x.cost),
        allocatedAt,
        acknowledgedAt: status !== 'ALLOCATED' ? plus(allocatedAt, 2 * HOUR) : null,
        usedAt: status === 'USED' ? plus(allocatedAt, DAY) : null,
        returnedAt: status === 'RETURNED' ? plus(allocatedAt, 2 * DAY) : null,
        notes: status === 'ALLOCATED' ? 'Pending acknowledgement in technician app' : null,
      });
    }
  });

  // Ledger: opening + receipts + transfers + van issues, consistent with the
  // final WarehouseStock.quantity snapshot.
  const ledger: Prisma.InventoryLedgerCreateManyInput[] = [];
  const movesByKey = new Map<string, { kind: Prisma.InventoryLedgerCreateManyInput['kind']; delta: number; at: Date; cost: number; ref: Partial<Prisma.InventoryLedgerCreateManyInput>; desc: string }[]>();
  const addMove = (itemId: string, whId: string, m: { kind: Prisma.InventoryLedgerCreateManyInput['kind']; delta: number; at: Date; cost: number; ref: Partial<Prisma.InventoryLedgerCreateManyInput>; desc: string }) => {
    const key = `${itemId}|${whId}`;
    movesByKey.set(key, [...(movesByKey.get(key) ?? []), m]);
  };
  receivedIn.forEach((r) => addMove(r.itemId, r.whId, { kind: 'IN_PURCHASE', delta: r.qty, at: r.at, cost: r.cost, ref: { purchaseOrderId: r.poId, goodsReceiptId: r.grnId }, desc: 'Goods receipt posted' }));
  transferMoves.forEach((t) => {
    addMove(t.itemId, t.from, { kind: 'OUT_TRANSFER', delta: -t.qty, at: t.at, cost: 0, ref: { transferId: t.transferId }, desc: 'Transfer dispatched' });
    if (t.to) addMove(t.itemId, t.to, { kind: 'IN_TRANSFER', delta: t.qty, at: plus(t.at, 2 * DAY), cost: 0, ref: { transferId: t.transferId }, desc: 'Transfer received' });
  });
  vanStock.forEach((v) => addMove(v.itemId, v.sourceWarehouseId, { kind: 'OUT_TO_TECHNICIAN', delta: -v.allocatedQty, at: v.allocatedAt instanceof Date ? v.allocatedAt : NOW, cost: v.unitCostMinor ?? 0, ref: { technicianId: v.technicianId, technicianAllocationId: v.id }, desc: 'Issued to technician van' }));
  vanStock.filter((v) => v.status === 'RETURNED').forEach((v) => addMove(v.itemId, v.sourceWarehouseId, { kind: 'IN_RETURN_TECHNICIAN', delta: v.returnedQty ?? 0, at: v.returnedAt instanceof Date ? v.returnedAt : NOW, cost: v.unitCostMinor ?? 0, ref: { technicianId: v.technicianId, technicianAllocationId: v.id }, desc: 'Returned from technician van' }));
  let ledgSeq = 0;
  for (const st of stocks) {
    const key = `${st.itemId}|${st.warehouseId}`;
    const moves = (movesByKey.get(key) ?? []).sort((a, b) => a.at.getTime() - b.at.getTime());
    const finalQty = stockQty.get(key) ?? 0;
    const net = moves.reduce((s, m) => s + m.delta, 0);
    let running = Math.max(0, finalQty - net);
    const reserved = st.reservedQuantity ?? 0;
    ledgSeq += 1;
    ledger.push({ id: did('ileg', ledgSeq), tenantId: T, itemId: st.itemId, warehouseId: st.warehouseId, kind: 'IN_OPENING', quantityDelta: running, runningQuantity: running, runningReserved: 0, unitCostMinor: st.avgCostMinor ?? 0, description: 'Opening balance', externalRef: `demo:open:${st.id}`, occurredAt: ago(45 * DAY), createdAt: ago(45 * DAY), createdBy: ctx.adminId });
    for (const m of moves) {
      running += m.delta;
      ledgSeq += 1;
      ledger.push({ id: did('ileg', ledgSeq), tenantId: T, itemId: st.itemId, warehouseId: st.warehouseId, kind: m.kind, quantityDelta: m.delta, runningQuantity: running, runningReserved: 0, unitCostMinor: m.cost, description: m.desc, externalRef: `demo:mv:${ledgSeq}`, occurredAt: m.at, createdAt: m.at, createdBy: ctx.dispatcherId, ...m.ref });
    }
    if (running !== finalQty) {
      // Opening was clamped at 0 — post a balancing adjustment.
      ledgSeq += 1;
      ledger.push({ id: did('ileg', ledgSeq), tenantId: T, itemId: st.itemId, warehouseId: st.warehouseId, kind: finalQty > running ? 'IN_ADJUSTMENT' : 'OUT_ADJUSTMENT', quantityDelta: finalQty - running, runningQuantity: finalQty, runningReserved: 0, adjustmentReason: 'Cycle count', description: 'Stock count adjustment', externalRef: `demo:adj:${ledgSeq}`, occurredAt: ago(DAY), createdAt: ago(DAY), createdBy: ctx.adminId });
      running = finalQty;
    }
    if (reserved > 0) {
      ledgSeq += 1;
      ledger.push({ id: did('ileg', ledgSeq), tenantId: T, itemId: st.itemId, warehouseId: st.warehouseId, kind: 'RESERVE', quantityDelta: 0, runningQuantity: running, runningReserved: reserved, description: 'Reserved for open booking', externalRef: `demo:res:${ledgSeq}`, occurredAt: ago(6 * HOUR), createdAt: ago(6 * HOUR), createdBy: ctx.dispatcherId });
    }
  }

  const alerts: Prisma.InventoryAlertCreateManyInput[] = [];
  lowStocks.forEach((l, k) => {
    const out = l.qty === 0;
    alerts.push({
      id: did('ialert', k + 1),
      tenantId: T,
      kind: out ? 'OUT_OF_STOCK' : 'LOW_STOCK',
      severity: out ? 'CRITICAL' : 'WARNING',
      status: k % 7 === 3 ? 'ACKNOWLEDGED' : k % 9 === 5 ? 'SNOOZED' : 'OPEN',
      itemId: l.itemId,
      warehouseId: l.whId,
      title: out ? `${l.name} is out of stock at ${l.whName}` : `${l.name} below reorder level at ${l.whName} (${l.qty}/${l.reorder})`,
      observedValue: l.qty,
      thresholdValue: l.reorder,
      acknowledgedBy: k % 7 === 3 ? ctx.dispatcherId : null,
      acknowledgedAt: k % 7 === 3 ? ago(5 * HOUR) : null,
      snoozedUntil: k % 9 === 5 ? plus(NOW, 2 * DAY) : null,
      dedupeKey: `demo:stock:${l.stockId}`,
      createdAt: ago(between(1, 72) * HOUR),
    });
  });
  alerts.push(
    { id: did('ialert', 'po3'), tenantId: T, kind: 'OVERDUE_PO', severity: 'WARNING', status: 'OPEN', vendorId: did('ven', 2), purchaseOrderId: did('po', 3), warehouseId: did('wh', 2), title: `${docNo('PO', 3)} from Mumbai Cooling Components is 7 days overdue`, observedValue: 7, thresholdValue: 0, dedupeKey: 'demo:po:3', createdAt: ago(DAY) },
    { id: did('ialert', 'trn1'), tenantId: T, kind: 'PENDING_TRANSFER', severity: 'INFO', status: 'OPEN', transferId: did('trn', 1), warehouseId: did('wh', 2), title: `${docNo('TRN', 1)} in transit for 2 days`, observedValue: 2, thresholdValue: 2, dedupeKey: 'demo:trn:1', createdAt: ago(4 * HOUR) },
    { id: did('ialert', 'tech5'), tenantId: T, kind: 'TECHNICIAN_MISMATCH', severity: 'WARNING', status: 'RESOLVED', technicianId: did('tech', 5), title: 'Van stock mismatch for Venkatesh Murthy (2 capacitors unaccounted)', observedValue: 2, thresholdValue: 0, resolvedAt: ago(2 * DAY), dedupeKey: 'demo:van:5', createdAt: ago(5 * DAY) },
    { id: did('ialert', 'slow'), tenantId: T, kind: 'SLOW_MOVING', severity: 'INFO', status: 'OPEN', itemId: itemBySku('ACR-GAS-R22-1KG').id, warehouseId: did('wh', 2), title: 'R22 refrigerant has not moved in 90+ days at Mumbai Andheri Branch', observedValue: 96, thresholdValue: 90, dedupeKey: 'demo:slow:r22', createdAt: ago(3 * DAY) },
  );

  // --------------------------------------------------------------------------
  // Growth: coupons, segments, campaigns, referrals, loyalty
  // --------------------------------------------------------------------------
  const couponUses = new Map<number, number>();
  for (const r of redemptions) {
    const idx = Number(String(r.couponId).split('_').pop());
    couponUses.set(idx, (couponUses.get(idx) ?? 0) + 1);
  }
  const coupons: Prisma.CouponCreateManyInput[] = [
    { id: did('coupon', 1), tenantId: T, code: 'WELCOME150', description: '₹150 off your first booking', discountType: 'FLAT', discountValue: inr(150), minOrderMinor: inr(499), validFrom: ago(90 * DAY), validUntil: plus(NOW, 75 * DAY), usageLimit: 1000, perCustomerLimit: 1, usedCount: couponUses.get(1) ?? 0, firstBookingOnly: true, createdBy: ctx.adminId, createdAt: ago(90 * DAY) },
    { id: did('coupon', 2), tenantId: T, code: 'MONSOON20', description: '20% off AC repair & servicing (max ₹300)', discountType: 'PERCENT', discountValue: 2000, maxDiscountMinor: inr(300), minOrderMinor: inr(799), validFrom: ago(40 * DAY), validUntil: plus(NOW, 14 * DAY), usageLimit: 500, usedCount: couponUses.get(2) ?? 0, categories: ['AC_REPAIR', 'AC_SERVICING'], createdBy: ctx.adminId, createdAt: ago(40 * DAY) },
    { id: did('coupon', 3), tenantId: T, code: 'AMCSAVE10', description: '10% off any AMC plan', discountType: 'PERCENT', discountValue: 1000, maxDiscountMinor: inr(600), validFrom: ago(10 * DAY), validUntil: plus(NOW, 50 * DAY), perCustomerLimit: 1, createdBy: ctx.adminId, createdAt: ago(10 * DAY) },
    { id: did('coupon', 4), tenantId: T, code: 'SUMMER500', description: 'Summer special — ₹500 off installations (expired)', discountType: 'FLAT', discountValue: inr(500), minOrderMinor: inr(1999), validFrom: ago(200 * DAY), validUntil: ago(110 * DAY), usageLimit: 200, usedCount: 143, categories: ['AC_INSTALLATION'], isActive: false, createdBy: ctx.adminId, createdAt: ago(200 * DAY) },
  ];
  const segments: Prisma.CustomerSegmentCreateManyInput[] = [
    { id: did('seg', 1), tenantId: T, name: 'Bengaluru AC owners — no service in 6 months', description: 'Target for pre-summer servicing drive.', rules: json({ cityIds: [ctx.cityIds.Bengaluru], categories: ['AC_REPAIR', 'AC_SERVICING'], lastBookingBeforeDays: 180 }), memberCount: 18, lastComputedAt: ago(6 * HOUR), createdBy: ctx.adminId, createdAt: ago(30 * DAY) },
    { id: did('seg', 2), tenantId: T, name: 'Appliance warranty expiring in 30 days', description: 'Upsell AMC / extended warranty.', rules: json({ applianceWarrantyExpiringInDays: 30, amcStatus: 'none' }), memberCount: 9, lastComputedAt: ago(DAY), createdBy: ctx.adminId, createdAt: ago(12 * DAY) },
  ];
  const campaigns: Prisma.CampaignCreateManyInput[] = [
    { id: did('camp', 1), tenantId: T, name: 'Monsoon AC check-up — WhatsApp blast', segmentId: did('seg', 1), channel: 'WHATSAPP', templateKey: 'booking.confirmation', message: 'Rains are here! Get your AC checked for just ₹499 + 20% off with code MONSOON20.', couponId: did('coupon', 2), status: 'COMPLETED', scheduledAt: ago(35 * DAY), startedAt: ago(35 * DAY), completedAt: plus(ago(35 * DAY), 40 * MIN), stats: json({ targeted: 412, sent: 398, failed: 14, converted: 37 }), createdBy: ctx.adminId, createdAt: ago(38 * DAY) },
    { id: did('camp', 2), tenantId: T, name: 'Diwali appliance health check (SMS)', segmentId: did('seg', 2), channel: 'SMS', templateKey: 'support.reply', message: 'This Diwali, give your appliances a health check. Book now and get AMC at 10% off: code AMCSAVE10.', couponId: did('coupon', 3), status: 'SCHEDULED', scheduledAt: plus(NOW, 5 * DAY), stats: json({ targeted: 9 }), createdBy: ctx.adminId, createdAt: ago(2 * DAY) },
    { id: did('camp', 3), tenantId: T, name: 'Winter geyser service reminder', channel: 'IN_APP', templateKey: 'support.reply', message: 'Winter is coming — book your geyser service before the rush.', status: 'DRAFT', stats: json({}), createdBy: did('user', 's01'), createdAt: ago(DAY) },
  ];
  const referralCodes: Prisma.ReferralCodeCreateManyInput[] = [];
  const referrals: Prisma.ReferralCreateManyInput[] = [];
  [1, 4, 8, 10, 14, 18, 24, 27, 33, 39].forEach((ci, k) => {
    const c = at(customers, ci - 1);
    referralCodes.push({ id: did('refc', k + 1), tenantId: T, customerId: c.id, code: `${(c.name.split(' ')[0] ?? 'REF').toUpperCase().slice(0, 8)}${100 + ci}`, createdAt: plus(c.createdAt, 3 * DAY) });
  });
  ([
    [1, 30, 'REWARDED'],
    [1, 35, 'QUALIFIED'],
    [3, 42, 'PENDING'],
    [5, 29, 'REWARDED'],
    [7, 45, 'REJECTED'],
  ] as [number, number, 'PENDING' | 'QUALIFIED' | 'REWARDED' | 'REJECTED'][]).forEach(([codeIdx, referredIdx, status], k) => {
    const rc = must(referralCodes[codeIdx - 1], 'referral code');
    const referred = at(customers, referredIdx - 1);
    const qb = bookings.find((b) => b.cust.id === referred.id && b.status === 'COMPLETED');
    referrals.push({
      id: did('ref', k + 1),
      tenantId: T,
      referralCodeId: must(rc.id, 'rc id'),
      referrerCustomerId: rc.customerId,
      referredCustomerId: referred.id,
      status,
      rewardMinor: status === 'REWARDED' || status === 'QUALIFIED' ? inr(200) : 0,
      qualifiedBookingId: status === 'QUALIFIED' || status === 'REWARDED' ? (qb?.id ?? null) : null,
      qualifiedAt: status === 'QUALIFIED' || status === 'REWARDED' ? ago(between(3, 20) * DAY) : null,
      rewardedAt: status === 'REWARDED' ? ago(between(1, 3) * DAY) : null,
      createdAt: ago(between(21, 40) * DAY),
    });
  });
  const loyalty: Prisma.LoyaltyLedgerEntryCreateManyInput[] = [];
  const loyaltyBalance = new Map<string, number>();
  payments
    .slice()
    .sort((a, b) => (a.createdAt as Date).getTime() - (b.createdAt as Date).getTime())
    .forEach((p, k) => {
      const inv = invoices.find((i) => i.id === p.invoiceId);
      if (!inv) return;
      const pts = Math.floor(p.amountMinor / 10000); // 1 point per ₹100
      if (pts <= 0) return;
      const bal = (loyaltyBalance.get(inv.customerId) ?? 0) + pts;
      loyaltyBalance.set(inv.customerId, bal);
      loyalty.push({ id: did('loy', k + 1), tenantId: T, customerId: inv.customerId, points: pts, balanceAfter: bal, reason: `Earned on invoice ${inv.number}`, refType: 'invoice', refId: inv.id, createdAt: p.createdAt });
    });
  referrals.filter((r) => r.status === 'REWARDED').forEach((r, k) => {
    const bal = (loyaltyBalance.get(r.referrerCustomerId) ?? 0) + 200;
    loyaltyBalance.set(r.referrerCustomerId, bal);
    loyalty.push({ id: did('loy', `r${k + 1}`), tenantId: T, customerId: r.referrerCustomerId, points: 200, balanceAfter: bal, reason: 'Referral reward', refType: 'referral', refId: r.id, createdAt: (r.rewardedAt as Date | null) ?? NOW });
  });
  const redeemer = [...loyaltyBalance.entries()].sort((a, b) => b[1] - a[1])[0];
  if (redeemer && redeemer[1] > 50) {
    const bal = redeemer[1] - 50;
    loyaltyBalance.set(redeemer[0], bal);
    loyalty.push({ id: did('loy', 'redeem1'), tenantId: T, customerId: redeemer[0], points: -50, balanceAfter: bal, reason: 'Redeemed ₹50 on booking', refType: 'booking', createdAt: ago(DAY) });
  }

  // --------------------------------------------------------------------------
  // Sales pipeline, tasks, custom fields
  // --------------------------------------------------------------------------
  const oppSpecs: [string, number | null, number | null, Prisma.OpportunityCreateManyInput['stage'], number, number, string | null][] = [
    ['Annual AMC for 120 split ACs — Lakeshore Gardens', 1, 3, 'NEGOTIATION', 480000, 70, null],
    ['VRF & cassette AC maintenance contract — Vertex Tech Park', 2, 13, 'PROPOSAL', 1250000, 50, null],
    ['64-room AC overhaul before peak season', 3, 28, 'QUALIFIED', 860000, 30, null],
    ['RO plant installation — 6 units (school campus)', 4, 40, 'WON', 210000, 100, null],
    ['New tower AC installation — 48 flats', 5, 23, 'NEW', 1680000, 10, null],
    ['Kitchen chimney deep-clean contract — Hotel Sea Breeze', 3, null, 'LOST', 95000, 0, 'Chose a cheaper local vendor'],
    ['Office pantry appliances AMC (fridges, microwaves, RO)', 2, null, 'QUALIFIED', 145000, 25, null],
    ['Society common-area geyser & pump servicing', 1, 6, 'PROPOSAL', 72000, 45, null],
    ['Builder handover snag-fixing — electrical & AC', 5, null, 'WON', 330000, 100, null],
    ['Home AMC bundle — 4 appliances (lead from website)', null, 20, 'NEGOTIATION', 18999, 65, null],
  ];
  const opportunities: Prisma.OpportunityCreateManyInput[] = oppSpecs.map(([title, acct, cust, stage, value, prob, lost], i) => ({
    id: did('opp', i + 1),
    tenantId: T,
    title,
    accountId: acct ? did('acct', acct) : null,
    customerId: cust ? did('cust', cust) : null,
    leadId: i === 9 ? did('lead', 17) : null,
    stage,
    valueMinor: inr(value),
    probabilityPct: prob,
    expectedCloseAt: stage === 'WON' || stage === 'LOST' ? null : plus(NOW, between(5, 60) * DAY),
    ownerUserId: at([ctx.adminId, did('user', 's01'), did('user', 's02')], i),
    lostReason: lost,
    closedAt: stage === 'WON' || stage === 'LOST' ? ago(between(2, 25) * DAY) : null,
    notes: i === 0 ? 'Committee meeting on the 25th. They want 2 dedicated technicians on Saturdays.' : null,
    createdAt: ago(between(10, 60) * DAY),
    createdBy: ctx.adminId,
  }));

  const taskSpecs: [string, Prisma.TaskCreateManyInput['status'], Prisma.TaskCreateManyInput['priority'], number | 'today', string | null, string | null][] = [
    ['Call back Ramya about AMC quote', 'OPEN', 'HIGH', -2, 'lead', did('lead', 10)],
    ['Collect pending payment from Rahul Deshpande', 'OPEN', 'URGENT', -4, 'customer', did('cust', 13)],
    ['Follow up with vendor on delayed PCB order', 'OPEN', 'NORMAL', -1, null, null],
    ['Verify technician documents — Venkatesh Murthy', 'IN_PROGRESS', 'NORMAL', -3, null, null],
    ['Confirm tomorrow’s pickup slot for TV repair', 'OPEN', 'HIGH', 'today', 'booking', did('book', 20)],
    ['Send revised proposal to Vertex Tech Park', 'OPEN', 'HIGH', 'today', 'opportunity', did('opp', 2)],
    ['Reply to escalated no-show complaint', 'OPEN', 'URGENT', 'today', 'ticket', did('tkt', 2)],
    ['Approve weekly technician payouts', 'OPEN', 'NORMAL', 'today', null, null],
    ['Plan Diwali campaign creatives', 'OPEN', 'LOW', 3, null, null],
    ['Schedule AMC visit for Ananya Iyer', 'OPEN', 'NORMAL', 2, 'customer', did('cust', 4)],
    ['Site survey — Lakeshore Gardens clubhouse', 'OPEN', 'NORMAL', 6, 'account', did('acct', 1)],
    ['Restock capacitors at Mumbai branch', 'DONE', 'HIGH', -5, null, null],
    ['Call customer for feedback on compressor job', 'DONE', 'LOW', -2, 'booking', did('book', 3)],
    ['Update KB article on R32 gas charging', 'DONE', 'NORMAL', -7, null, null],
    ['Cancelled: demo for builder walkthrough', 'CANCELLED', 'LOW', -6, 'account', did('acct', 5)],
  ];
  const tasks: Prisma.TaskCreateManyInput[] = taskSpecs.map(([title, status, priority, due, entityType, entityId], i) => {
    const dueAt = due === 'today' ? istAt(0, pick([12, 15, 17, 18])) : istAt(due, pick([10, 12, 16]));
    const reminderAt = plus(dueAt, -HOUR);
    return {
      id: did('task', i + 1),
      tenantId: T,
      title,
      description: i % 3 === 0 ? 'Added from the dashboard quick-actions. Update the linked record once done.' : null,
      status,
      priority,
      dueAt,
      reminderAt,
      reminderSentAt: reminderAt < NOW ? reminderAt : null,
      assigneeUserId: at(staffIds, i),
      entityType,
      entityId,
      completedAt: status === 'DONE' ? plus(dueAt, -2 * HOUR) : null,
      createdAt: ago(between(8, 14) * DAY),
      createdBy: ctx.adminId,
    };
  });
  const customFields: Prisma.CustomFieldDefinitionCreateManyInput[] = [
    { id: did('cfd', 1), tenantId: T, entity: 'customer', key: 'preferred_contact_time', label: 'Preferred contact time', fieldType: 'select', options: json(['Morning (9–12)', 'Afternoon (12–4)', 'Evening (4–8)']), sortOrder: 1, createdBy: ctx.adminId },
    { id: did('cfd', 2), tenantId: T, entity: 'booking', key: 'gate_pass_required', label: 'Gate pass required', fieldType: 'boolean', options: json([]), sortOrder: 1, createdBy: ctx.adminId },
  ];

  // --------------------------------------------------------------------------
  // Dispatch: assignments, alerts, location pings, availability, shifts
  // --------------------------------------------------------------------------
  const dispatchAssignments: Prisma.DispatchAssignmentCreateManyInput[] = [];
  bookings.forEach((b) => {
    if (!b.tech || !b.assignedAt) return;
    const auto = b.n % 4 !== 0;
    const breakdown = { skillMatch: 1, proximity: Number((0.5 + rand() * 0.5).toFixed(2)), workload: Number((0.4 + rand() * 0.6).toFixed(2)), rating: Number(((TECH_SPECS.find((t) => did('tech', t.n) === b.tech?.id)?.rating ?? 4.3) / 5).toFixed(2)) };
    const base = {
      tenantId: T,
      bookingId: b.id,
      technicianId: b.tech.id,
      score: Number((breakdown.proximity * 0.4 + breakdown.workload * 0.3 + breakdown.rating * 0.3).toFixed(3)),
      breakdown: json(breakdown),
      distanceKm: Number((1 + rand() * 11).toFixed(1)),
      etaMin: between(12, 55),
    };
    if (b.n % 11 === 0) {
      const other = techs.find((t) => t.city === b.cust.city.name && t.id !== b.tech?.id);
      if (other) {
        dispatchAssignments.push({ ...base, id: did('dasg', `${b.n}_0`), technicianId: other.id, decision: 'AUTO_ASSIGNED', createdAt: plus(b.assignedAt, -20 * MIN) });
        dispatchAssignments.push({ ...base, id: did('dasg', b.n), decision: 'REASSIGNED', reason: 'Original technician rejected — vehicle breakdown', replacesId: did('dasg', `${b.n}_0`), actorUserId: ctx.dispatcherId, createdAt: b.assignedAt });
        return;
      }
    }
    dispatchAssignments.push({ ...base, id: did('dasg', b.n), decision: auto ? 'AUTO_ASSIGNED' : 'MANUAL_ASSIGNED', actorUserId: auto ? null : ctx.dispatcherId, createdAt: b.assignedAt });
  });
  const enRoute = bookings.find((b) => b.status === 'TECHNICIAN_EN_ROUTE');
  const overdue = bookings.find((b) => b.status === 'PENDING' && b.scheduledAt < NOW);
  const dispatchEvents: Prisma.DispatchEventCreateManyInput[] = [
    { id: did('devt', 1), tenantId: T, cityId: ctx.cityIds.Bengaluru, kind: 'TECHNICIAN_DELAYED', severity: 'warning', resourceType: 'booking', resourceId: enRoute?.id ?? null, technicianId: enRoute?.tech?.id ?? did('tech', 2), message: `${enRoute?.tech?.name ?? 'Technician'} is running ~20 min late for ${enRoute?.code ?? 'a booking'}`, metadata: json({ delayMin: 20 }), createdAt: ago(12 * MIN) },
    { id: did('devt', 2), tenantId: T, cityId: ctx.cityIds.Delhi, kind: 'TECHNICIAN_UNREACHABLE', severity: 'critical', resourceType: 'technician', resourceId: did('tech', 8), technicianId: did('tech', 8), message: 'Gurpreet Singh Bhatia has not sent a location ping for 45 minutes', metadata: json({ lastSeenMin: 45 }), createdAt: ago(40 * MIN) },
    { id: did('devt', 3), tenantId: T, cityId: overdue ? ctx.cityIds[overdue.cust.city.name] : ctx.cityIds.Bengaluru, kind: 'BOOKING_OVERDUE', severity: 'critical', resourceType: 'booking', resourceId: overdue?.id ?? null, message: `${overdue?.code ?? 'Booking'} is past its slot and still unassigned`, metadata: json({}), createdAt: ago(25 * MIN) },
    { id: did('devt', 4), tenantId: T, cityId: ctx.cityIds.Mumbai, kind: 'LOW_AVAILABILITY', severity: 'warning', message: 'Only 1 technician available in Mumbai for the 15:00–17:00 slot', metadata: json({ available: 1, slot: '15:00-17:00' }), acknowledgedAt: ago(HOUR), acknowledgedBy: ctx.dispatcherId, createdAt: ago(2 * HOUR) },
    { id: did('devt', 5), tenantId: T, cityId: ctx.cityIds.Delhi, kind: 'NO_CANDIDATES', severity: 'warning', resourceType: 'booking', message: 'No skilled technician found for a chimney job in Delhi — needs manual assignment', metadata: json({ category: 'CHIMNEY' }), createdAt: ago(3 * HOUR) },
    { id: did('devt', 6), tenantId: T, cityId: ctx.cityIds.Bengaluru, kind: 'TECHNICIAN_DELAYED', severity: 'info', technicianId: did('tech', 1), message: 'Manjunath Gowda job running 30 min over estimate', metadata: json({}), acknowledgedAt: ago(DAY), acknowledgedBy: ctx.dispatcherId, createdAt: ago(DAY + HOUR) },
  ];
  const locations: Prisma.TechnicianLocationCreateManyInput[] = [];
  const availability: Prisma.TechnicianAvailabilityCreateManyInput[] = [];
  const shifts: Prisma.TechnicianShiftCreateManyInput[] = [];
  technicians.forEach((t, ti) => {
    const spec = must(TECH_SPECS[ti], 'tech spec');
    const online = !['OFFLINE', 'UNREACHABLE'].includes(spec.status);
    const pings = online ? 8 : spec.status === 'UNREACHABLE' ? 3 : 0;
    for (let p = 0; p < pings; p++) {
      const back = (pings - 1 - p) * 4 * MIN + (spec.status === 'UNREACHABLE' ? 45 * MIN : 0);
      locations.push({
        id: did('tloc', `${spec.n}_${p + 1}`),
        tenantId: T,
        technicianId: t.id!,
        latitude: (t.lastLatitude ?? 0) - (pings - 1 - p) * 0.0012,
        longitude: (t.lastLongitude ?? 0) - (pings - 1 - p) * 0.0009,
        accuracyM: between(5, 20),
        heading: between(0, 359),
        speedMps: spec.status === 'EN_ROUTE' ? Number((5 + rand() * 7).toFixed(1)) : Number((rand() * 1.5).toFixed(1)),
        batteryPct: Math.max(5, (t.lastBatteryPct ?? 60) + (pings - p)),
        isBackground: p % 3 === 0,
        source: 'expo-background',
        deviceId: `demo-device-${spec.n}`,
        recordedAt: ago(back),
        receivedAt: ago(back - 2000),
      });
    }
    for (let d = 1; d <= 7; d++) {
      const day = dateOnly(ago(d * DAY));
      const off = (d + ti) % 7 === 0;
      availability.push({
        id: did('tavail', `${spec.n}_${d}`),
        tenantId: T,
        technicianId: t.id!,
        date: day,
        onlineMinutes: off ? 0 : between(380, 560),
        availableMinutes: off ? 0 : between(60, 180),
        workingMinutes: off ? 0 : between(200, 380),
        onBreakMinutes: off ? 0 : between(20, 60),
        acceptedJobs: off ? 0 : between(3, 7),
        rejectedJobs: off ? 0 : between(0, 1),
        completedJobs: off ? 0 : between(3, 6),
        cancelledJobs: off ? 0 : between(0, 1),
        avgRating: off ? null : Number((spec.rating - 0.3 + rand() * 0.5).toFixed(1)),
        avgResponseTimeMin: off ? null : between(6, 25),
        avgTravelTimeMin: off ? null : between(18, 45),
      });
    }
    if (online) {
      const started = ago(between(120, 300) * MIN);
      shifts.push({ id: did('tshift', `${spec.n}_today`), tenantId: T, technicianId: t.id!, startedAt: started, startedLatitude: t.lastLatitude ?? null, startedLongitude: t.lastLongitude ?? null, createdAt: started });
    }
    const y = istAt(-1, 9, between(0, 30));
    shifts.push({ id: did('tshift', `${spec.n}_y`), tenantId: T, technicianId: t.id!, startedAt: y, endedAt: plus(y, 9 * HOUR), durationMin: 540, endReason: 'manual', createdAt: y });
  });

  // --------------------------------------------------------------------------
  // Notifications
  // --------------------------------------------------------------------------
  const notifications: Prisma.NotificationCreateManyInput[] = [];
  let notifSeq = 0;
  const notify = (row: Omit<Prisma.NotificationCreateManyInput, 'id' | 'tenantId'>) => {
    notifSeq += 1;
    notifications.push({ id: did('notif', notifSeq), tenantId: T, provider: row.channel === 'IN_APP' ? 'in-app' : 'mock', ...row });
  };
  bookings.filter((b) => b.tech && b.assignedAt).slice(0, 10).forEach((b, k) => {
    notify({ userId: b.tech?.userId ?? null, channel: 'IN_APP', template: 'booking.technician_assigned', status: k < 6 ? 'READ' : 'DELIVERED', payload: json({ code: b.code, technician: b.tech?.name, bookingId: b.id }), sentAt: b.assignedAt, deliveredAt: b.assignedAt, readAt: k < 6 ? plus(b.assignedAt!, 4 * MIN) : null, createdAt: b.assignedAt! });
  });
  leadRows.filter((l) => l.assignedUserId).slice(0, 6).forEach((l, k) => {
    notify({ userId: l.assignedUserId ?? null, channel: 'IN_APP', template: 'lead.assigned', status: k % 2 === 0 ? 'READ' : 'DELIVERED', payload: json({ leadId: l.code, customerName: l.customerName }), sentAt: l.assignedAt, deliveredAt: l.assignedAt, createdAt: l.assignedAt as Date });
  });
  bookings.filter((b) => b.status !== 'DRAFT').slice(0, 12).forEach((b, k) => {
    const failed = k === 7;
    notify({ userId: b.cust.userId, channel: k % 3 === 0 ? 'WHATSAPP' : 'SMS', template: 'booking.confirmation', status: failed ? 'FAILED' : k % 2 === 0 ? 'DELIVERED' : 'SENT', payload: json({ code: b.code, customerName: b.cust.name, scheduledAt: b.scheduledAt.toISOString() }), recipientPhone: b.cust.phone, retryCount: failed ? 5 : 0, failureReason: failed ? 'DLT template mismatch (provider error 4012)' : null, sentAt: failed ? null : plus(b.createdAt, MIN), deliveredAt: !failed && k % 2 === 0 ? plus(b.createdAt, 2 * MIN) : null, createdAt: b.createdAt });
  });
  invoices.filter((i) => i.status !== 'DRAFT' && i.issueDate).slice(0, 6).forEach((i) => {
    notify({ userId: did('user', `c${String(Number(i.customerId.split('_').pop())).padStart(2, '0')}`), channel: 'SMS', template: 'invoice.generated', status: 'DELIVERED', payload: json({ number: i.number, totalMinor: i.totalMinor, dueAmountMinor: i.dueAmountMinor }), sentAt: i.issueDate, deliveredAt: i.issueDate, createdAt: i.issueDate as Date });
  });
  [
    ['support.ticket.created', 'New urgent ticket: Geyser tripping MCB — elderly parents at home', 'DELIVERED'],
    ['dispatch.alert', 'Gurpreet Singh Bhatia is unreachable (no ping for 45 min)', 'DELIVERED'],
    ['inventory.alert', 'R32 refrigerant below reorder level at Mumbai Andheri Branch', 'READ'],
    ['payout.ready', 'Weekly technician payouts are ready for approval', 'DELIVERED'],
  ].forEach(([template, title, status], k) => {
    notify({ userId: k % 2 === 0 ? ctx.adminId : ctx.dispatcherId, channel: 'IN_APP', template: template!, status: status as 'DELIVERED' | 'READ', payload: json({ title, body: title }), sentAt: ago((k + 1) * 35 * MIN), deliveredAt: ago((k + 1) * 35 * MIN), readAt: status === 'READ' ? ago(10 * MIN) : null, createdAt: ago((k + 1) * 35 * MIN) });
  });

  // --------------------------------------------------------------------------
  // Customer aggregates
  // --------------------------------------------------------------------------
  const bookingCounts = new Map<string, number>();
  bookings.forEach((b) => bookingCounts.set(b.cust.id, (bookingCounts.get(b.cust.id) ?? 0) + 1));
  for (const row of customerRows) {
    row.totalBookings = bookingCounts.get(row.id!) ?? 0;
    row.lifetimeValueMinor = BigInt(custPaid.get(row.id!) ?? 0);
    row.loyaltyPoints = loyaltyBalance.get(row.id!) ?? 0;
    const amc = amcSpecs.find((a) => did('cust', a.cust) === row.id && a.status === 'ACTIVE');
    if (amc) row.tags = [...new Set([...(row.tags as string[]), 'amc'])];
  }

  // ==========================================================================
  // Insert (parents first). skipDuplicates makes re-runs a no-op.
  // ==========================================================================
  const inserted: [string, number][] = [];
  const ins = async (name: string, run: () => Promise<{ count: number }>) => {
    const { count } = await run();
    inserted.push([name, count]);
  };
  const S = { skipDuplicates: true } as const;
  await ins('User', () => prisma.user.createMany({ data: users, ...S }));
  await ins('UserRoleAssignment', () => prisma.userRoleAssignment.createMany({ data: roleLinks, ...S }));
  await ins('Technician', () => prisma.technician.createMany({ data: technicians, ...S }));
  await ins('TechnicianCommissionRule', () => prisma.technicianCommissionRule.createMany({ data: commissionRules, ...S }));
  await ins('Account', () => prisma.account.createMany({ data: accounts, ...S }));
  await ins('Customer', () => prisma.customer.createMany({ data: customerRows, ...S }));
  await ins('Address', () => prisma.address.createMany({ data: addressRows, ...S }));
  // Link default addresses (idempotent).
  await prisma.$executeRaw`UPDATE customers SET "defaultAddressId" = 'demo_addr_' || substring(id from 11) WHERE starts_with(id, 'demo_cust_') AND "defaultAddressId" IS NULL`;
  await ins('CustomerAppliance', () => prisma.customerAppliance.createMany({ data: applianceRows, ...S }));
  await ins('Lead', () => prisma.lead.createMany({ data: leadRows, ...S }));
  await ins('LeadNote', () => prisma.leadNote.createMany({ data: leadNotes, ...S }));
  await ins('LeadActivity', () => prisma.leadActivity.createMany({ data: leadActivities, ...S }));
  await ins('Warehouse', () => prisma.warehouse.createMany({ data: warehouses, ...S }));
  await ins('WarehouseZone', () => prisma.warehouseZone.createMany({ data: zones, ...S }));
  await ins('Vendor', () => prisma.vendor.createMany({ data: vendors, ...S }));
  await ins('InventoryItem', () => prisma.inventoryItem.createMany({ data: items, ...S }));
  await ins('Booking', async () => {
    const a = await prisma.booking.createMany({ data: bookingRows.filter((b) => !b.parentBookingId), ...S });
    const b = await prisma.booking.createMany({ data: bookingRows.filter((r) => r.parentBookingId), ...S });
    return { count: a.count + b.count };
  });
  await ins('BookingActivity', () => prisma.bookingActivity.createMany({ data: bookingActivities, ...S }));
  await ins('BookingNote', () => prisma.bookingNote.createMany({ data: bookingNotes, ...S }));
  await ins('JobCard', () => prisma.jobCard.createMany({ data: jobCards, ...S }));
  await ins('WorkshopJob', () => prisma.workshopJob.createMany({ data: workshopJobs, ...S }));
  await ins('BookingRating', () => prisma.bookingRating.createMany({ data: ratings, ...S }));
  await ins('AMCSubscription', () => prisma.aMCSubscription.createMany({ data: amcSubs, ...S }));
  await ins('AMCVisit', () => prisma.aMCVisit.createMany({ data: amcVisits, ...S }));
  await ins('Invoice', () => prisma.invoice.createMany({ data: invoices, ...S }));
  await ins('InvoiceLineItem', () => prisma.invoiceLineItem.createMany({ data: invoiceLines, ...S }));
  await ins('PaymentTransaction', () => prisma.paymentTransaction.createMany({ data: paymentTxns, ...S }));
  await ins('Payment', () => prisma.payment.createMany({ data: payments, ...S }));
  await ins('CustomerLedgerEntry', () => prisma.customerLedgerEntry.createMany({ data: ledgerRows, ...S }));
  await ins('Quotation', () => prisma.quotation.createMany({ data: quotations, ...S }));
  await ins('QuotationLineItem', () => prisma.quotationLineItem.createMany({ data: quoteLines, ...S }));
  await ins('TechnicianPayout', () => prisma.technicianPayout.createMany({ data: payouts, ...S }));
  await ins('TechnicianCommission', () => prisma.technicianCommission.createMany({ data: commissions, ...S }));
  await ins('SLAProfile', () => prisma.sLAProfile.createMany({ data: slaProfiles, ...S }));
  await ins('SupportTicket', () => prisma.supportTicket.createMany({ data: tickets, ...S }));
  await ins('TicketMessage', () => prisma.ticketMessage.createMany({ data: ticketMessages, ...S }));
  await ins('TicketActivity', () => prisma.ticketActivity.createMany({ data: ticketActivities, ...S }));
  await ins('Conversation', () => prisma.conversation.createMany({ data: conversations, ...S }));
  await ins('ConversationParticipant', () => prisma.conversationParticipant.createMany({ data: convParticipants, ...S }));
  await ins('ConversationMessage', () => prisma.conversationMessage.createMany({ data: convMessages, ...S }));
  await ins('CallLog', () => prisma.callLog.createMany({ data: callLogs, ...S }));
  await ins('KnowledgeBaseCategory', () => prisma.knowledgeBaseCategory.createMany({ data: kbCats, ...S }));
  await ins('KnowledgeBaseArticle', () => prisma.knowledgeBaseArticle.createMany({ data: kbArticles, ...S }));
  await ins('CannedResponse', () => prisma.cannedResponse.createMany({ data: canned, ...S }));
  await ins('WarrantyClaim', () => prisma.warrantyClaim.createMany({ data: warrantyClaims, ...S }));
  await ins('WarehouseStock', () => prisma.warehouseStock.createMany({ data: stocks, ...S }));
  await ins('PurchaseOrder', () => prisma.purchaseOrder.createMany({ data: pos, ...S }));
  await ins('PurchaseOrderItem', () => prisma.purchaseOrderItem.createMany({ data: poItems, ...S }));
  await ins('GoodsReceipt', () => prisma.goodsReceipt.createMany({ data: grns, ...S }));
  await ins('GoodsReceiptItem', () => prisma.goodsReceiptItem.createMany({ data: grnItems, ...S }));
  await ins('StockTransfer', () => prisma.stockTransfer.createMany({ data: transfers, ...S }));
  await ins('StockTransferItem', () => prisma.stockTransferItem.createMany({ data: transferItems, ...S }));
  await ins('TechnicianInventory', () => prisma.technicianInventory.createMany({ data: vanStock, ...S }));
  await ins('InventoryLedger', () => prisma.inventoryLedger.createMany({ data: ledger, ...S }));
  await ins('InventoryAlert', () => prisma.inventoryAlert.createMany({ data: alerts, ...S }));
  await ins('Coupon', () => prisma.coupon.createMany({ data: coupons, ...S }));
  await ins('CouponRedemption', () => prisma.couponRedemption.createMany({ data: redemptions, ...S }));
  await ins('CustomerSegment', () => prisma.customerSegment.createMany({ data: segments, ...S }));
  await ins('Campaign', () => prisma.campaign.createMany({ data: campaigns, ...S }));
  await ins('ReferralCode', () => prisma.referralCode.createMany({ data: referralCodes, ...S }));
  await ins('Referral', () => prisma.referral.createMany({ data: referrals, ...S }));
  await ins('LoyaltyLedgerEntry', () => prisma.loyaltyLedgerEntry.createMany({ data: loyalty, ...S }));
  await ins('Opportunity', () => prisma.opportunity.createMany({ data: opportunities, ...S }));
  await ins('Task', () => prisma.task.createMany({ data: tasks, ...S }));
  await ins('CustomFieldDefinition', () => prisma.customFieldDefinition.createMany({ data: customFields, ...S }));
  await ins('DispatchAssignment', () => prisma.dispatchAssignment.createMany({ data: dispatchAssignments.filter((d) => !d.replacesId), ...S }));
  await ins('DispatchAssignment(reassign)', () => prisma.dispatchAssignment.createMany({ data: dispatchAssignments.filter((d) => d.replacesId), ...S }));
  await ins('DispatchEvent', () => prisma.dispatchEvent.createMany({ data: dispatchEvents, ...S }));
  await ins('TechnicianLocation', () => prisma.technicianLocation.createMany({ data: locations, ...S }));
  await ins('TechnicianAvailability', () => prisma.technicianAvailability.createMany({ data: availability, ...S }));
  await ins('TechnicianShift', () => prisma.technicianShift.createMany({ data: shifts, ...S }));
  await ins('Notification', () => prisma.notification.createMany({ data: notifications, ...S }));

  const newRows = inserted.reduce((s, [, c]) => s + c, 0);
  console.info(newRows === 0 ? '  ✓ Demo data already present — nothing inserted.' : `  ✓ Inserted ${newRows} new demo rows.`);
}

// ============================================================================
// Summary
// ============================================================================

const SUMMARY_MODELS = [
  'user', 'technician', 'account', 'customer', 'address', 'customerAppliance', 'lead', 'leadNote', 'leadActivity',
  'booking', 'bookingActivity', 'bookingNote', 'jobCard', 'workshopJob', 'bookingRating',
  'invoice', 'invoiceLineItem', 'payment', 'paymentTransaction', 'customerLedgerEntry', 'quotation', 'quotationLineItem',
  'aMCSubscription', 'aMCVisit', 'technicianCommissionRule', 'technicianCommission', 'technicianPayout',
  'sLAProfile', 'supportTicket', 'ticketMessage', 'ticketActivity', 'conversation', 'conversationParticipant', 'conversationMessage', 'callLog',
  'knowledgeBaseCategory', 'knowledgeBaseArticle', 'cannedResponse', 'warrantyClaim',
  'warehouse', 'warehouseZone', 'vendor', 'inventoryItem', 'warehouseStock', 'inventoryLedger', 'purchaseOrder', 'purchaseOrderItem',
  'goodsReceipt', 'goodsReceiptItem', 'stockTransfer', 'stockTransferItem', 'technicianInventory', 'inventoryAlert',
  'coupon', 'couponRedemption', 'customerSegment', 'campaign', 'referralCode', 'referral', 'loyaltyLedgerEntry',
  'opportunity', 'task', 'customFieldDefinition', 'dispatchAssignment', 'dispatchEvent', 'technicianLocation', 'technicianAvailability', 'technicianShift',
  'notification',
] as const;

async function printSummary(): Promise<void> {
  // Delegates are looked up by name; typed as a minimal count() interface.
  const client = prisma as unknown as Record<string, { count: (args?: { where?: Record<string, unknown> }) => Promise<number> }>;
  const rows: { model: string; demo: number; total: number }[] = [];
  for (const m of SUMMARY_MODELS) {
    const delegate = client[m];
    if (!delegate) continue;
    const [demo, total] = await Promise.all([delegate.count({ where: { id: demoId } }), delegate.count()]);
    rows.push({ model: m.charAt(0).toUpperCase() + m.slice(1), demo, total });
  }
  console.table(rows);
}

// ============================================================================
// Entry point
// ============================================================================

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  if (args.has('--reset') || args.has('--fresh')) await reset();
  if (!args.has('--reset') || args.has('--fresh')) await seed();
  await printSummary();
}

main()
  .catch((err: unknown) => {
    console.error('Demo seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
