/**
 * Service catalogue.
 *
 * This is the *content* layer for the public website. The CRM/API has the
 * operational service categories (`ServiceCategory` enum in `@ac/types`)
 * but those are bare identifiers. SEO needs rich content per service —
 * H1 copy, USPs, FAQs, pricing bands, JSON-LD descriptors.
 *
 * We map each `ServiceCategory` to one or more public services. Multiple
 * services can share a backing category (e.g. AC_REPAIR backs both
 * `/services/ac-repair` and `/services/ac-gas-refill`). The `category`
 * field is what we send to the lead-creation API so the CRM still knows
 * the operational bucket.
 */

import type { ServiceCategory } from '@ac/types';

export interface ServicePricingBand {
  label: string;
  /** Display string — keep simple, e.g. "₹299" or "From ₹1,499". */
  price: string;
  /** Short description shown under the price band. */
  description: string;
}

export interface ServiceFaq {
  question: string;
  answer: string;
}

export interface Service {
  /** URL slug — `/services/${slug}`. Must be kebab-case. */
  slug: string;
  /** Maps to the operational ServiceCategory in the CRM. */
  category: ServiceCategory;
  /** Short marketing name (≤ 60 chars). */
  name: string;
  /** SEO H1. */
  heading: string;
  /** Meta description (≤ 160 chars). */
  description: string;
  /** Hero subhead — 1-2 sentences. */
  subheading: string;
  /** Hero image — referenced from public/images. */
  heroImage: string;
  /** Iconography token used by `<ServiceIcon kind={…} />`. */
  icon:
    | 'ac'
    | 'fridge'
    | 'washer'
    | 'microwave'
    | 'geyser'
    | 'chimney'
    | 'tv'
    | 'general';
  /** Top-3 USPs surfaced in the hero strip. */
  usps: string[];
  /** What's covered — bulleted list rendered on the service page. */
  inclusions: string[];
  /** Issues this service typically fixes — also fuels long-tail SEO copy. */
  issues: string[];
  /** Pricing bands shown on `/pricing` and the landing pages. */
  pricing: ServicePricingBand[];
  /** Brands serviced — `lg`, `samsung`, etc. Maps to `brands.ts`. */
  brandSlugs: string[];
  /** FAQ block — fuels FAQPage JSON-LD. */
  faqs: ServiceFaq[];
  /** Estimated time per visit, shown on the booking funnel. */
  visitDurationMin: number;
  /** Whether emergency / same-day option is supported. */
  emergencyAvailable: boolean;
  /** SEO keywords used in `<meta name="keywords">` and OG. */
  keywords: string[];
}

export const SERVICES: Service[] = [
  {
    slug: 'ac-repair',
    category: 'AC_REPAIR',
    name: 'AC Repair',
    heading: 'AC Repair at Home — Same-Day Service by Verified Experts',
    description:
      'AC not cooling, leaking, or making noise? Book trained AC repair technicians today. Transparent pricing, 30-day service warranty, live tracking.',
    subheading:
      'Background-verified technicians, genuine parts, and a 30-day service warranty on every repair.',
    heroImage: '/images/services/ac-repair.webp',
    icon: 'ac',
    usps: ['Same-day visits', '30-day warranty', 'Genuine spare parts'],
    inclusions: [
      'Cooling diagnosis & error-code check',
      'PCB / capacitor / sensor inspection',
      'Gas-leak detection with electronic detector',
      'Filter & coil cleanout',
      'Performance benchmark before & after',
    ],
    issues: [
      'AC not cooling enough',
      'Water leakage from indoor unit',
      'Strange noise or vibration',
      'Foul smell from vents',
      'AC tripping the circuit',
      'Remote not responding',
      'Ice formation on the coil',
    ],
    pricing: [
      { label: 'Visit & diagnosis', price: '₹299', description: 'Adjusted into final repair if you go ahead.' },
      { label: 'Standard repair', price: 'From ₹699', description: 'PCB, capacitor, sensor & wiring repairs.' },
      { label: 'Gas top-up (window AC)', price: 'From ₹2,499', description: 'Includes leak-detection & pressure test.' },
      { label: 'Gas top-up (split AC)', price: 'From ₹2,899', description: '1.0/1.5/2.0 tonne units.' },
    ],
    brandSlugs: ['lg', 'samsung', 'daikin', 'voltas', 'bluestar', 'hitachi', 'panasonic', 'whirlpool'],
    faqs: [
      {
        question: 'How much does AC repair cost at home?',
        answer:
          'A diagnosis visit costs ₹299 and is adjusted into the final repair if you go ahead. Standard repairs start at ₹699; gas top-ups start at ₹2,499 (window) and ₹2,899 (split). You see the quote on your phone before any work begins.',
      },
      {
        question: 'How long does an AC repair take?',
        answer:
          'Most repairs are completed in the same visit (60–90 minutes). Complex jobs involving PCB replacement or gas refilling may take up to 2 hours. We give you a precise ETA at booking.',
      },
      {
        question: 'Do you offer a service warranty?',
        answer:
          'Yes — every repair is covered by our 30-day service warranty on labour and any parts we install. If the same issue recurs within 30 days, we revisit free of charge.',
      },
      {
        question: 'Which AC brands do you service?',
        answer:
          'We service every major brand including LG, Samsung, Daikin, Voltas, Blue Star, Hitachi, Panasonic, Whirlpool, Lloyd, Mitsubishi, Carrier and O-General.',
      },
    ],
    visitDurationMin: 90,
    emergencyAvailable: true,
    keywords: [
      'ac repair near me',
      'split ac repair',
      'window ac repair',
      'ac gas refill',
      'ac not cooling repair',
      'ac repair home service',
    ],
  },
  {
    slug: 'ac-installation',
    category: 'AC_INSTALLATION',
    name: 'AC Installation',
    heading: 'AC Installation by Certified Technicians',
    description:
      'New AC installation or relocation at home. Standard or premium installation kits, copper piping, free demo. Same-day slots available.',
    subheading: 'Standard or premium installation kits, copper piping, free demo and 90-day workmanship warranty.',
    heroImage: '/images/services/ac-installation.webp',
    icon: 'ac',
    usps: ['Same-day install', 'Genuine copper kit', '90-day warranty'],
    inclusions: [
      'Site survey & wall-bracket fitting',
      'Copper piping up to 3 metres',
      'Drainpipe & insulation',
      'Performance test & gas pressure check',
      'Free demo of remote functions',
    ],
    issues: [
      'New split AC installation',
      'Window AC installation',
      'AC relocation between rooms / homes',
      'Outdoor unit re-mounting',
      'Drainpipe & insulation replacement',
    ],
    pricing: [
      { label: 'Window AC installation', price: '₹599', description: 'Standard mount, sealing, drainpipe.' },
      { label: 'Split AC installation (standard)', price: '₹1,499', description: 'Up to 3 m copper, basic insulation.' },
      { label: 'Split AC installation (premium)', price: '₹2,499', description: 'Heavy-duty bracket, premium copper, foam insulation.' },
      { label: 'AC relocation', price: 'From ₹2,499', description: 'Uninstall + reinstall at new location.' },
    ],
    brandSlugs: ['lg', 'samsung', 'daikin', 'voltas', 'bluestar', 'hitachi', 'panasonic', 'whirlpool'],
    faqs: [
      {
        question: 'What is included in standard split AC installation?',
        answer:
          'Wall-bracket fitting, up to 3 metres of copper piping, drainpipe, insulation, gas-pressure test and a free 10-minute demo on remote functions.',
      },
      {
        question: 'Do you charge extra for copper piping beyond 3 metres?',
        answer:
          'Yes — additional copper piping is ₹650/metre and additional drainpipe is ₹70/metre. The technician will confirm the requirement during the site survey before any work begins.',
      },
    ],
    visitDurationMin: 120,
    emergencyAvailable: false,
    keywords: [
      'ac installation',
      'split ac installation cost',
      'ac installation near me',
      'ac relocation service',
    ],
  },
  {
    slug: 'ac-servicing',
    category: 'AC_SERVICING',
    name: 'AC Servicing',
    heading: 'AC Deep Cleaning & Servicing',
    description:
      'Annual AC servicing — chemical wash, deep clean of filters & coils, anti-bacterial treatment. Improves cooling efficiency up to 30%.',
    subheading:
      'Annual chemical wash, deep clean of filters and coils, anti-bacterial treatment — improves cooling efficiency by up to 30%.',
    heroImage: '/images/services/ac-servicing.webp',
    icon: 'ac',
    usps: ['Improves cooling 30%', 'Anti-bacterial treatment', 'Lower power bill'],
    inclusions: [
      'Filter & coil chemical wash',
      'Outdoor unit pressure clean',
      'Drainpipe flush & deodorization',
      'Electrical & gas-pressure check',
      'Anti-bacterial fogging',
    ],
    issues: [
      'Reduced cooling over time',
      'High electricity bill',
      'Bad smell when AC turns on',
      'Black dust around vents',
      'Allergies or breathing irritation',
    ],
    pricing: [
      { label: 'Standard service (split)', price: '₹599', description: 'Filter clean + visual inspection.' },
      { label: 'Deep clean / chemical wash', price: '₹1,299', description: 'Indoor + outdoor unit + drainpipe.' },
      { label: 'Window AC service', price: '₹499', description: 'Filter + coil + drainpipe.' },
    ],
    brandSlugs: ['lg', 'samsung', 'daikin', 'voltas', 'bluestar', 'hitachi', 'panasonic'],
    faqs: [
      {
        question: 'How often should I service my AC?',
        answer:
          'For homes in Indian cities we recommend a deep service every 6 months and a basic filter clean every 3 months. Heavy usage areas (kitchens, ground-floor flats) benefit from quarterly servicing.',
      },
    ],
    visitDurationMin: 75,
    emergencyAvailable: false,
    keywords: ['ac service', 'ac deep cleaning', 'ac chemical wash', 'ac servicing near me'],
  },
  {
    slug: 'washing-machine-repair',
    category: 'WASHING_MACHINE',
    name: 'Washing Machine Repair',
    heading: 'Washing Machine Repair at Home',
    description:
      'Front load, top load, semi-automatic — every washing machine repaired by certified technicians. Same-day visits, 30-day warranty.',
    subheading: 'Front load, top load, semi-automatic — every model serviced by certified technicians.',
    heroImage: '/images/services/washer.webp',
    icon: 'washer',
    usps: ['All brands', '30-day warranty', 'Same-day visit'],
    inclusions: [
      'Error-code diagnosis',
      'Motor, drum & belt inspection',
      'Drain pump & pipe cleaning',
      'Door / lid switch repair',
      'Performance test cycle',
    ],
    issues: [
      'Not draining water',
      'Drum not spinning',
      'Excess vibration / noise',
      'Door / lid won\'t lock',
      'Error code on display',
      'Water leakage',
      'Burning smell',
    ],
    pricing: [
      { label: 'Visit & diagnosis', price: '₹299', description: 'Adjusted into repair total.' },
      { label: 'Standard repair', price: 'From ₹599', description: 'Switch, belt, drainpipe, sensor.' },
      { label: 'Motor repair / replacement', price: 'From ₹1,999', description: 'Genuine OEM motor.' },
    ],
    brandSlugs: ['lg', 'samsung', 'whirlpool', 'ifb', 'bosch', 'haier', 'godrej', 'panasonic'],
    faqs: [
      {
        question: 'Do you repair both top-load and front-load washing machines?',
        answer:
          'Yes — our technicians are certified for top-load, front-load and semi-automatic washing machines across all major brands.',
      },
    ],
    visitDurationMin: 75,
    emergencyAvailable: true,
    keywords: [
      'washing machine repair',
      'front load washing machine repair',
      'washing machine not draining',
      'washing machine repair near me',
    ],
  },
  {
    slug: 'refrigerator-repair',
    category: 'REFRIGERATOR',
    name: 'Refrigerator Repair',
    heading: 'Refrigerator Repair — Same-Day Service',
    description:
      'Single-door, double-door, side-by-side refrigerators repaired by trained technicians. Gas leak, compressor, cooling — fixed today.',
    subheading: 'Single-door, double-door, side-by-side — every fridge fixed by trained technicians.',
    heroImage: '/images/services/refrigerator.webp',
    icon: 'fridge',
    usps: ['Same-day visit', 'Gas-leak detection', '30-day warranty'],
    inclusions: [
      'Cooling diagnosis & temperature test',
      'Compressor & relay inspection',
      'Gas-leak detection',
      'Thermostat / sensor / PCB repair',
      'Defrost timer & drainage check',
    ],
    issues: [
      'Not cooling / freezer not freezing',
      'Excess frost formation',
      'Compressor not running',
      'Water leakage at the base',
      'Strange noise',
      'Door not sealing',
    ],
    pricing: [
      { label: 'Visit & diagnosis', price: '₹299', description: 'Adjusted into repair total.' },
      { label: 'Standard repair', price: 'From ₹699', description: 'Thermostat, sensor, light, gasket.' },
      { label: 'Gas refill (single door)', price: 'From ₹1,799', description: 'Includes leak-test & pressure check.' },
      { label: 'Gas refill (double door)', price: 'From ₹2,499', description: 'Frost-free models.' },
    ],
    brandSlugs: ['lg', 'samsung', 'whirlpool', 'haier', 'godrej', 'bosch', 'panasonic'],
    faqs: [
      {
        question: 'What does refrigerator gas refilling cost?',
        answer:
          'Gas refilling starts at ₹1,799 for single-door units and ₹2,499 for double-door frost-free units. The price includes leak-detection and a pressure-test after the refill.',
      },
    ],
    visitDurationMin: 90,
    emergencyAvailable: true,
    keywords: ['refrigerator repair', 'fridge gas refill', 'double door refrigerator repair'],
  },
  {
    slug: 'microwave-repair',
    category: 'MICROWAVE',
    name: 'Microwave Repair',
    heading: 'Microwave Oven Repair at Home',
    description:
      'Solo, grill, convection microwaves repaired at home. Magnetron, transformer, heating-element issues fixed by experts.',
    subheading: 'Solo, grill, convection microwaves repaired by experts. Magnetron, transformer & heating-element issues fixed.',
    heroImage: '/images/services/microwave.webp',
    icon: 'microwave',
    usps: ['Brand-agnostic', '30-day warranty', 'Genuine parts'],
    inclusions: [
      'Magnetron diagnosis',
      'High-voltage transformer test',
      'Heating-element check',
      'Turntable motor inspection',
      'Door interlock & touchpad repair',
    ],
    issues: [
      'Not heating',
      'Sparking inside',
      'Display not working',
      'Door not closing properly',
      'Turntable not rotating',
      'Burning smell',
    ],
    pricing: [
      { label: 'Visit & diagnosis', price: '₹299', description: 'Adjusted into repair total.' },
      { label: 'Standard repair', price: 'From ₹599', description: 'Door switch, fuse, touchpad.' },
      { label: 'Magnetron replacement', price: 'From ₹1,899', description: 'Genuine OEM magnetron.' },
    ],
    brandSlugs: ['lg', 'samsung', 'ifb', 'whirlpool', 'panasonic', 'godrej'],
    faqs: [
      {
        question: 'Is it safe to use a microwave that sparks?',
        answer:
          'No. A sparking microwave usually has a damaged waveguide cover or arcing on the cavity wall — turn it off and book a technician. Continued use is a fire hazard.',
      },
    ],
    visitDurationMin: 60,
    emergencyAvailable: false,
    keywords: ['microwave repair', 'microwave oven repair', 'convection microwave repair'],
  },
  {
    slug: 'geyser-repair',
    category: 'GEYSER',
    name: 'Geyser Repair',
    heading: 'Water Heater (Geyser) Repair',
    description:
      'Storage and instant geysers repaired at home. Heating element, thermostat, leak issues fixed with genuine parts.',
    subheading: 'Storage and instant geysers fixed at home — heating element, thermostat & leak issues handled by experts.',
    heroImage: '/images/services/geyser.webp',
    icon: 'geyser',
    usps: ['All capacities', '30-day warranty', 'Same-day visit'],
    inclusions: [
      'Heating-element test',
      'Thermostat & temperature-cutoff check',
      'MCB / power-supply diagnosis',
      'Tank leak inspection',
      'Anode rod inspection',
    ],
    issues: [
      'Not heating water',
      'Water too hot / cuts off',
      'Leakage from tank',
      'Tripping the MCB',
      'Sediment / discoloured water',
    ],
    pricing: [
      { label: 'Visit & diagnosis', price: '₹299', description: 'Adjusted into repair total.' },
      { label: 'Heating element', price: 'From ₹1,099', description: 'OEM compatible element.' },
      { label: 'Thermostat replacement', price: 'From ₹499', description: 'Includes recalibration.' },
    ],
    brandSlugs: ['ao-smith', 'racold', 'bajaj', 'havells', 'crompton', 'venus'],
    faqs: [
      {
        question: 'Can leaking geysers be repaired?',
        answer:
          'Small fittings / valve leaks are repairable on the spot. Tank corrosion is usually not repairable — we will recommend replacement if the inner tank is compromised.',
      },
    ],
    visitDurationMin: 60,
    emergencyAvailable: true,
    keywords: ['geyser repair', 'water heater repair', 'geyser not heating'],
  },
  {
    slug: 'chimney-cleaning',
    category: 'CHIMNEY',
    name: 'Chimney Service',
    heading: 'Kitchen Chimney Deep Cleaning & Repair',
    description:
      'Auto-clean and conventional chimneys deep-cleaned and repaired by certified technicians. Filter, motor, baffle and wiring issues solved.',
    subheading: 'Auto-clean and conventional chimneys deep-cleaned by certified technicians.',
    heroImage: '/images/services/chimney.webp',
    icon: 'chimney',
    usps: ['Deep degreasing', 'All brands', '30-day warranty'],
    inclusions: [
      'Filter / baffle detach & degrease',
      'Motor cleaning & lubrication',
      'Duct & exhaust check',
      'Auto-clean cycle test',
      'Reinstall & alignment',
    ],
    issues: [
      'Reduced suction',
      'Noisy motor',
      'Auto-clean not working',
      'Lights or touch-panel issue',
      'Oil dripping back into the cooktop',
    ],
    pricing: [
      { label: 'Deep clean (standard)', price: '₹1,199', description: 'Filter + motor + duct.' },
      { label: 'Deep clean (auto-clean)', price: '₹1,499', description: 'Auto-clean cycle test included.' },
      { label: 'Repair', price: 'From ₹599', description: 'Switch / motor / wiring.' },
    ],
    brandSlugs: ['faber', 'elica', 'hindware', 'kaff', 'sunflame', 'kutchina'],
    faqs: [
      {
        question: 'How often should I deep-clean my kitchen chimney?',
        answer:
          'For Indian cooking we recommend a deep clean every 3 months. Auto-clean models can stretch to 6 months. Heavy fried-food usage homes benefit from monthly suction-checks.',
      },
    ],
    visitDurationMin: 75,
    emergencyAvailable: false,
    keywords: ['chimney cleaning', 'kitchen chimney repair', 'auto clean chimney service'],
  },
];

const SLUG_INDEX = new Map(SERVICES.map((s) => [s.slug, s] as const));
const CATEGORY_INDEX = new Map(SERVICES.map((s) => [s.category, s] as const));

export function getServiceBySlug(slug: string): Service | null {
  return SLUG_INDEX.get(slug) ?? null;
}

export function getServiceByCategory(cat: ServiceCategory): Service | null {
  return CATEGORY_INDEX.get(cat) ?? null;
}

/** Used by generateStaticParams for `/services/[slug]`. */
export function getAllServiceSlugs(): string[] {
  return SERVICES.map((s) => s.slug);
}
