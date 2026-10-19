/**
 * Repair-domain starter data — service catalog (rate card), fault codes,
 * checklist templates and repair notification templates. Idempotent:
 * catalog + fault codes upsert on their unique keys, checklists on
 * (tenant, category, kind, name).
 */
import type { Prisma, PrismaClient, ServiceCategory } from '@prisma/client';

type Cat = ServiceCategory;

/** ₹ → paise. */
const inr = (rupees: number) => Math.round(rupees * 100);

interface CatalogSeed {
  code: string;
  category: Cat;
  name: string;
  price: number;
  visit?: number;
  minutes?: number;
  warrantyDays?: number;
  description?: string;
}

const CATALOG: CatalogSeed[] = [
  // AC
  { code: 'AC-INSPECT', category: 'AC_REPAIR', name: 'AC inspection & diagnosis', price: 0, visit: 299, minutes: 30, warrantyDays: 0 },
  { code: 'AC-GAS-REFILL', category: 'AC_REPAIR', name: 'AC gas refill (R32/R410A, full charge)', price: 2499, visit: 0, minutes: 90, warrantyDays: 90 },
  { code: 'AC-GAS-TOPUP', category: 'AC_REPAIR', name: 'AC gas top-up', price: 1499, minutes: 60, warrantyDays: 30 },
  { code: 'AC-LEAK-FIX', category: 'AC_REPAIR', name: 'Gas leak detection & brazing', price: 999, minutes: 90, warrantyDays: 60 },
  { code: 'AC-PCB-REPAIR', category: 'AC_REPAIR', name: 'PCB repair (indoor/outdoor)', price: 1999, minutes: 120, warrantyDays: 90 },
  { code: 'AC-CAPACITOR', category: 'AC_REPAIR', name: 'Capacitor replacement (labour)', price: 499, minutes: 45, warrantyDays: 30 },
  { code: 'AC-COMPRESSOR', category: 'AC_REPAIR', name: 'Compressor replacement (labour)', price: 3499, minutes: 240, warrantyDays: 180 },
  { code: 'AC-FAN-MOTOR', category: 'AC_REPAIR', name: 'Fan motor replacement (labour)', price: 899, minutes: 90, warrantyDays: 90 },
  { code: 'AC-SVC-SPLIT', category: 'AC_SERVICING', name: 'Split AC power-jet service', price: 599, minutes: 60, warrantyDays: 30 },
  { code: 'AC-SVC-WINDOW', category: 'AC_SERVICING', name: 'Window AC service', price: 499, minutes: 60, warrantyDays: 30 },
  { code: 'AC-SVC-DEEP', category: 'AC_SERVICING', name: 'Deep clean (foam + coil wash)', price: 999, minutes: 90, warrantyDays: 30 },
  { code: 'AC-INSTALL-SPLIT', category: 'AC_INSTALLATION', name: 'Split AC installation', price: 1499, minutes: 150, warrantyDays: 180 },
  { code: 'AC-INSTALL-WINDOW', category: 'AC_INSTALLATION', name: 'Window AC installation', price: 799, minutes: 90, warrantyDays: 180 },
  { code: 'AC-UNINSTALL', category: 'AC_INSTALLATION', name: 'AC uninstallation', price: 699, minutes: 60, warrantyDays: 0 },
  // Refrigerator
  { code: 'FRIDGE-INSPECT', category: 'REFRIGERATOR', name: 'Refrigerator inspection', price: 0, visit: 299, minutes: 30, warrantyDays: 0 },
  { code: 'FRIDGE-GAS', category: 'REFRIGERATOR', name: 'Refrigerator gas charging', price: 1999, minutes: 120, warrantyDays: 90 },
  { code: 'FRIDGE-THERMOSTAT', category: 'REFRIGERATOR', name: 'Thermostat replacement (labour)', price: 599, minutes: 60, warrantyDays: 60 },
  { code: 'FRIDGE-DEFROST', category: 'REFRIGERATOR', name: 'Defrost heater / timer repair', price: 799, minutes: 90, warrantyDays: 60 },
  { code: 'FRIDGE-COMPRESSOR', category: 'REFRIGERATOR', name: 'Compressor replacement (labour)', price: 2999, minutes: 240, warrantyDays: 180 },
  // Washing machine
  { code: 'WM-INSPECT', category: 'WASHING_MACHINE', name: 'Washing machine inspection', price: 0, visit: 299, minutes: 30, warrantyDays: 0 },
  { code: 'WM-DRAIN', category: 'WASHING_MACHINE', name: 'Drain pump / blockage repair', price: 699, minutes: 60, warrantyDays: 60 },
  { code: 'WM-DOORLOCK', category: 'WASHING_MACHINE', name: 'Door lock replacement (labour)', price: 599, minutes: 45, warrantyDays: 60 },
  { code: 'WM-PCB', category: 'WASHING_MACHINE', name: 'Control board repair', price: 1799, minutes: 120, warrantyDays: 90 },
  { code: 'WM-DRUM-BEARING', category: 'WASHING_MACHINE', name: 'Drum bearing replacement', price: 2199, minutes: 180, warrantyDays: 90 },
  { code: 'WM-SERVICE', category: 'WASHING_MACHINE', name: 'Washing machine service & descaling', price: 699, minutes: 60, warrantyDays: 30 },
  // Microwave / oven
  { code: 'MW-REPAIR', category: 'MICROWAVE', name: 'Microwave repair (not heating)', price: 799, minutes: 60, warrantyDays: 60 },
  { code: 'MW-MAGNETRON', category: 'MICROWAVE', name: 'Magnetron replacement (labour)', price: 999, minutes: 60, warrantyDays: 90 },
  { code: 'OVEN-REPAIR', category: 'OVEN', name: 'OTG / built-in oven repair', price: 899, minutes: 60, warrantyDays: 60 },
  // Geyser
  { code: 'GEYSER-REPAIR', category: 'GEYSER', name: 'Geyser repair (no heating)', price: 499, minutes: 45, warrantyDays: 30 },
  { code: 'GEYSER-ELEMENT', category: 'GEYSER', name: 'Heating element replacement', price: 699, minutes: 60, warrantyDays: 90 },
  { code: 'GEYSER-INSTALL', category: 'GEYSER', name: 'Geyser installation', price: 599, minutes: 60, warrantyDays: 90 },
  // Chimney
  { code: 'CHIMNEY-CLEAN', category: 'CHIMNEY', name: 'Chimney deep cleaning', price: 1299, minutes: 90, warrantyDays: 30 },
  { code: 'CHIMNEY-MOTOR', category: 'CHIMNEY', name: 'Chimney motor repair', price: 999, minutes: 90, warrantyDays: 60 },
  // TV
  { code: 'TV-INSPECT', category: 'TELEVISION', name: 'TV inspection', price: 0, visit: 349, minutes: 30, warrantyDays: 0 },
  { code: 'TV-BACKLIGHT', category: 'TELEVISION', name: 'LED backlight strip replacement', price: 2499, minutes: 150, warrantyDays: 90 },
  { code: 'TV-BOARD', category: 'TELEVISION', name: 'Mainboard / power board repair', price: 1999, minutes: 120, warrantyDays: 90 },
  { code: 'TV-WALLMOUNT', category: 'TELEVISION', name: 'TV wall mounting', price: 499, minutes: 45, warrantyDays: 30 },
  // RO
  { code: 'RO-SERVICE', category: 'WATER_PURIFIER', name: 'RO service (filter clean + TDS check)', price: 399, minutes: 45, warrantyDays: 30 },
  { code: 'RO-FILTER-KIT', category: 'WATER_PURIFIER', name: 'RO filter kit replacement (labour)', price: 499, minutes: 45, warrantyDays: 90 },
  { code: 'RO-MEMBRANE', category: 'WATER_PURIFIER', name: 'RO membrane replacement (labour)', price: 599, minutes: 45, warrantyDays: 90 },
  { code: 'RO-PUMP', category: 'WATER_PURIFIER', name: 'Booster pump / SMPS repair', price: 799, minutes: 60, warrantyDays: 60 },
  { code: 'RO-INSTALL', category: 'WATER_PURIFIER', name: 'RO installation', price: 499, minutes: 60, warrantyDays: 90 },
  // Others
  { code: 'DW-REPAIR', category: 'DISHWASHER', name: 'Dishwasher repair', price: 999, minutes: 90, warrantyDays: 60 },
  { code: 'COOLER-SERVICE', category: 'AIR_COOLER', name: 'Air cooler service (pads + pump)', price: 399, minutes: 45, warrantyDays: 30 },
  { code: 'UPS-REPAIR', category: 'INVERTER_UPS', name: 'Inverter / UPS repair', price: 699, minutes: 60, warrantyDays: 60 },
  { code: 'UPS-BATTERY', category: 'INVERTER_UPS', name: 'Battery check & water top-up', price: 299, minutes: 30, warrantyDays: 30 },
  { code: 'FAN-REPAIR', category: 'CEILING_FAN', name: 'Ceiling fan repair (capacitor/winding)', price: 299, minutes: 45, warrantyDays: 30 },
  { code: 'FAN-INSTALL', category: 'CEILING_FAN', name: 'Ceiling fan installation', price: 249, minutes: 30, warrantyDays: 30 },
  { code: 'VAC-REPAIR', category: 'VACUUM_CLEANER', name: 'Vacuum cleaner repair', price: 599, minutes: 60, warrantyDays: 30 },
  { code: 'ELEC-INSPECT', category: 'ELECTRICAL_WIRING', name: 'Electrician visit & fault finding', price: 0, visit: 249, minutes: 30, warrantyDays: 0 },
  { code: 'ELEC-MCB', category: 'ELECTRICAL_WIRING', name: 'MCB / DB replacement (labour)', price: 399, minutes: 45, warrantyDays: 30 },
  { code: 'ELEC-WIRING-PT', category: 'ELECTRICAL_WIRING', name: 'Wiring per point', price: 199, minutes: 30, warrantyDays: 30 },
  { code: 'OTHER-VISIT', category: 'OTHER', name: 'General appliance visit', price: 0, visit: 299, minutes: 30, warrantyDays: 0 },
];

interface FaultSeed {
  category: Cat;
  code: string;
  title: string;
  brand?: string;
  fix?: string;
}

const FAULT_CODES: FaultSeed[] = [
  { category: 'AC_REPAIR', code: 'E1', title: 'Indoor room temperature sensor fault', fix: 'Check sensor resistance; replace thermistor.' },
  { category: 'AC_REPAIR', code: 'E4', title: 'Low refrigerant / gas leak protection', fix: 'Leak test with nitrogen, braze, vacuum and recharge.' },
  { category: 'AC_REPAIR', code: 'E6', title: 'Indoor–outdoor communication error', fix: 'Check signal wire, terminal block and PCBs.' },
  { category: 'AC_REPAIR', code: 'F0', title: 'Refrigerant leak detected / low gas', fix: 'Check pressure (expect 120–140 psi R32 standing), fix leak, recharge.' },
  { category: 'AC_REPAIR', code: 'F1', title: 'Outdoor ambient sensor fault', fix: 'Replace outdoor thermistor.' },
  { category: 'AC_REPAIR', code: 'H6', title: 'Indoor fan motor feedback fault', fix: 'Check fan motor and Hall sensor; replace motor.' },
  { category: 'AC_REPAIR', code: 'P4', title: 'Compressor overheating / inverter overcurrent', fix: 'Check gas charge, condenser airflow, compressor windings.' },
  { category: 'AC_REPAIR', code: 'PCB', title: 'Control PCB failure', fix: 'Inspect for burnt components; repair or replace PCB.' },
  { category: 'AC_REPAIR', code: 'COMP', title: 'Compressor not starting / tripping', fix: 'Check capacitor, winding resistance, earth leakage.' },
  { category: 'AC_REPAIR', code: 'NO-COOL', title: 'Not cooling / insufficient cooling', fix: 'Clean filters/coils, check gas pressure and fan speeds.' },
  { category: 'AC_REPAIR', code: 'WATER-LEAK', title: 'Water leaking from indoor unit', fix: 'Clear drain line, check tray and unit slope.' },
  { category: 'REFRIGERATOR', code: 'NO-COOL', title: 'Refrigerator not cooling', fix: 'Check compressor, thermostat, condenser fan and gas.' },
  { category: 'REFRIGERATOR', code: 'ICE-BUILDUP', title: 'Excess ice / defrost failure', fix: 'Test defrost heater, bimetal and timer.' },
  { category: 'REFRIGERATOR', code: 'NOISE', title: 'Abnormal noise', fix: 'Check fan blades, compressor mounts.' },
  { category: 'REFRIGERATOR', code: 'COMP-TRIP', title: 'Compressor trips / clicks', fix: 'Check relay/OLP, voltage and compressor windings.' },
  { category: 'WASHING_MACHINE', code: 'OE', title: 'Drain error (water not draining)', brand: 'LG', fix: 'Clean drain filter and pump; check hose.' },
  { category: 'WASHING_MACHINE', code: 'DE', title: 'Door open / door lock error', brand: 'LG', fix: 'Check door lock switch and wiring.' },
  { category: 'WASHING_MACHINE', code: 'UE', title: 'Unbalanced load', fix: 'Redistribute load; check shock absorbers and levelling.' },
  { category: 'WASHING_MACHINE', code: '4C', title: 'Water supply error', brand: 'Samsung', fix: 'Check inlet tap, inlet valve filter and pressure.' },
  { category: 'WASHING_MACHINE', code: '5C', title: 'Drain error', brand: 'Samsung', fix: 'Clear debris filter and drain pump.' },
  { category: 'WASHING_MACHINE', code: 'DOOR-LOCK', title: 'Door lock fault', fix: 'Replace door interlock.' },
  { category: 'WASHING_MACHINE', code: 'NO-SPIN', title: 'Drum not spinning', fix: 'Check belt, motor brushes, capacitor, PCB.' },
  { category: 'WATER_PURIFIER', code: 'LOW-PRESSURE', title: 'Low water flow / pressure', fix: 'Check inlet pressure, booster pump, clogged pre-filters.' },
  { category: 'WATER_PURIFIER', code: 'HIGH-TDS', title: 'High TDS in output', fix: 'Replace membrane; adjust TDS controller.' },
  { category: 'WATER_PURIFIER', code: 'LEAK', title: 'Water leakage', fix: 'Replace fittings / O-rings.' },
  { category: 'WATER_PURIFIER', code: 'NO-POWER', title: 'Purifier not powering on', fix: 'Check SMPS adaptor and float switch.' },
  { category: 'TELEVISION', code: 'NO-DISPLAY', title: 'Sound but no display', fix: 'Check backlight strips, T-con, panel.' },
  { category: 'TELEVISION', code: 'BACKLIGHT', title: 'Backlight failure (dark screen)', fix: 'Replace LED strips; check driver voltage.' },
  { category: 'TELEVISION', code: 'NO-POWER', title: 'TV not powering on', fix: 'Check power board, fuse, standby voltage.' },
  { category: 'TELEVISION', code: 'LINES', title: 'Vertical/horizontal lines on screen', fix: 'Check T-con and panel flex cables.' },
  { category: 'MICROWAVE', code: 'NO-HEAT', title: 'Runs but does not heat', fix: 'Test magnetron, HV diode, HV capacitor.' },
  { category: 'GEYSER', code: 'NO-HEAT', title: 'Water not heating', fix: 'Check element, thermostat and thermal cut-out.' },
  { category: 'GEYSER', code: 'ELCB-TRIP', title: 'ELCB / MCB tripping', fix: 'Check element insulation and earthing.' },
  { category: 'CHIMNEY', code: 'LOW-SUCTION', title: 'Low suction', fix: 'Clean filters and blower; check motor.' },
  { category: 'INVERTER_UPS', code: 'NO-BACKUP', title: 'Low / no backup', fix: 'Load test battery; check charging circuit.' },
  { category: 'CEILING_FAN', code: 'SLOW', title: 'Fan running slow', fix: 'Replace capacitor; check bearings.' },
  { category: 'ELECTRICAL_WIRING', code: 'SHORT', title: 'Short circuit / MCB tripping', fix: 'Isolate circuit, megger test, fix wiring.' },
];

type ItemType = 'bool' | 'number' | 'text' | 'photo';
interface Item {
  key: string;
  label: string;
  type: ItemType;
  unit?: string;
  required: boolean;
}
const b = (key: string, label: string, required = true): Item => ({ key, label, type: 'bool', required });
const n = (key: string, label: string, unit: string, required = true): Item => ({ key, label, type: 'number', unit, required });
const t = (key: string, label: string, required = false): Item => ({ key, label, type: 'text', required });
const p = (key: string, label: string, required = false): Item => ({ key, label, type: 'photo', required });

const SAFETY_COMMON: Item[] = [
  n('supplyVoltage', 'Supply voltage', 'V'),
  b('earthingOk', 'Earthing checked and OK'),
  b('powerIsolated', 'Power isolated before work'),
  b('ppeUsed', 'PPE used (gloves / shoes)'),
];

const PRE_COMMON: Item[] = [
  t('customerComplaint', 'Customer complaint (in their words)', true),
  p('beforePhoto', 'Photo before work', true),
  b('physicalDamage', 'Visible physical damage present', false),
];

const POST_COMMON: Item[] = [
  b('testRunOk', 'Test run OK'),
  b('areaCleaned', 'Work area cleaned'),
  p('afterPhoto', 'Photo after work', true),
  b('customerDemoGiven', 'Customer shown the fix', false),
];

/** Category → extra post-service items. */
const POST_EXTRA: Partial<Record<Cat, Item[]>> = {
  AC_REPAIR: [
    n('gasPressurePsi', 'Gas pressure (suction)', 'psi'),
    n('currentAmps', 'Running current', 'A'),
    n('outletTempC', 'Indoor outlet air temperature', '°C'),
    b('filterCleaned', 'Filters cleaned'),
    b('drainChecked', 'Drain line checked'),
  ],
  AC_SERVICING: [
    n('gasPressurePsi', 'Gas pressure (suction)', 'psi'),
    n('currentAmps', 'Running current', 'A'),
    b('filterCleaned', 'Filters cleaned'),
    b('coilCleaned', 'Indoor + outdoor coil washed'),
    b('drainChecked', 'Drain line checked'),
  ],
  AC_INSTALLATION: [
    n('vacuumMicrons', 'Vacuum achieved', 'micron'),
    n('pipeLengthFt', 'Copper pipe length used', 'ft'),
    b('leakTestDone', 'Leak test done'),
    b('drainSlopeOk', 'Drain slope verified'),
    n('currentAmps', 'Running current', 'A'),
  ],
  REFRIGERATOR: [
    n('freezerTempC', 'Freezer temperature', '°C'),
    n('fridgeTempC', 'Fridge temperature', '°C'),
    n('currentAmps', 'Compressor current', 'A'),
    b('gasketOk', 'Door gasket sealing OK'),
  ],
  WASHING_MACHINE: [
    b('drainOk', 'Drain cycle OK'),
    b('spinOk', 'Spin cycle OK'),
    b('doorLockOk', 'Door lock engages'),
    b('noLeak', 'No leakage during test wash'),
  ],
  WATER_PURIFIER: [
    n('inputTds', 'Input TDS', 'ppm'),
    n('outputTds', 'Output TDS', 'ppm'),
    n('flowLph', 'Output flow', 'L/h', false),
    b('filtersChanged', 'Filters changed (if due)', false),
  ],
  TELEVISION: [b('displayOk', 'Display OK on all inputs'), b('soundOk', 'Sound OK'), b('remoteOk', 'Remote working', false)],
  MICROWAVE: [b('heatingOk', 'Heating test OK (water test)'), b('doorSwitchOk', 'Door interlock OK')],
  OVEN: [b('heatingOk', 'Heating elements OK'), n('tempReachedC', 'Max temperature reached', '°C', false)],
  GEYSER: [b('heatingOk', 'Water heats up'), b('thermostatOk', 'Thermostat cuts off'), b('noLeak', 'No leakage')],
  CHIMNEY: [b('suctionOk', 'Suction OK'), b('filtersCleaned', 'Filters cleaned')],
  DISHWASHER: [b('washOk', 'Wash cycle OK'), b('drainOk', 'Drain OK')],
  AIR_COOLER: [b('pumpOk', 'Pump OK'), b('padsReplaced', 'Pads cleaned / replaced', false)],
  INVERTER_UPS: [n('batteryVoltage', 'Battery voltage', 'V'), b('changeoverOk', 'Changeover OK')],
  CEILING_FAN: [b('speedOk', 'All speeds OK'), b('noWobble', 'No wobble / noise')],
  VACUUM_CLEANER: [b('suctionOk', 'Suction OK')],
  ELECTRICAL_WIRING: [n('insulationMohm', 'Insulation resistance', 'MΩ', false), b('mcbOk', 'MCB / RCCB tested')],
  OTHER: [],
};

const ALL_CATEGORIES = Object.keys(POST_EXTRA) as Cat[];

const REPAIR_NOTIFICATION_TEMPLATES: {
  key: string;
  channel: 'SMS' | 'WHATSAPP' | 'PUSH';
  body: string;
}[] = [
  { key: 'workshop.status_changed', channel: 'SMS', body: 'Your appliance for booking {{code}} is {{statusLabel}} (job {{number}}).' },
  { key: 'workshop.status_changed', channel: 'WHATSAPP', body: 'Hi {{customerName}}, update on booking {{code}}: your appliance is {{statusLabel}}.' },
  { key: 'workshop.status_changed', channel: 'PUSH', body: 'Booking {{code}}: appliance {{statusLabel}}.' },
  { key: 'warranty.claim_decided', channel: 'SMS', body: 'Your warranty claim {{number}} has been {{decision}}.' },
  { key: 'warranty.claim_decided', channel: 'WHATSAPP', body: 'Hi {{customerName}}, your warranty claim {{number}} has been {{decision}}.' },
  { key: 'warranty.revisit_scheduled', channel: 'SMS', body: 'Free warranty revisit {{code}} scheduled for {{scheduledAt}} (claim {{number}}).' },
  { key: 'warranty.revisit_scheduled', channel: 'WHATSAPP', body: 'Hi {{customerName}}, your free warranty revisit {{code}} is scheduled for {{scheduledAt}}.' },
];

export async function seedRepair(prisma: PrismaClient, tenantId: string): Promise<void> {
  for (const [i, c] of CATALOG.entries()) {
    const data = {
      category: c.category,
      name: c.name,
      description: c.description ?? null,
      basePriceMinor: inr(c.price),
      visitChargeMinor: inr(c.visit ?? 0),
      estimatedMinutes: c.minutes ?? 60,
      repairWarrantyDays: c.warrantyDays ?? 30,
      gstRateBps: 1800,
      sacCode: '998719',
      isActive: true,
      sortOrder: i,
      deletedAt: null,
    };
    await prisma.serviceCatalogItem.upsert({
      where: { tenantId_code: { tenantId, code: c.code } },
      update: data,
      create: { ...data, tenantId, code: c.code },
    });
  }
  console.info(`  ✓ Service catalog: ${CATALOG.length} items`);

  for (const f of FAULT_CODES) {
    const data = {
      brand: f.brand ?? null,
      title: f.title,
      suggestedFix: f.fix ?? null,
      isActive: true,
      deletedAt: null,
    };
    await prisma.faultCode.upsert({
      where: { tenantId_category_code: { tenantId, category: f.category, code: f.code } },
      update: data,
      create: { ...data, tenantId, category: f.category, code: f.code },
    });
  }
  console.info(`  ✓ Fault codes: ${FAULT_CODES.length}`);

  let templates = 0;
  for (const category of ALL_CATEGORIES) {
    const label = category.replace(/_/g, ' ').toLowerCase();
    const specs: { kind: 'PRE_SERVICE' | 'POST_SERVICE' | 'SAFETY'; name: string; items: Item[] }[] = [
      { kind: 'SAFETY', name: `Safety — ${label}`, items: SAFETY_COMMON },
      { kind: 'PRE_SERVICE', name: `Pre-service — ${label}`, items: PRE_COMMON },
      { kind: 'POST_SERVICE', name: `Post-service — ${label}`, items: [...(POST_EXTRA[category] ?? []), ...POST_COMMON] },
    ];
    for (const spec of specs) {
      const existing = await prisma.checklistTemplate.findFirst({
        where: { tenantId, category, kind: spec.kind, name: spec.name },
        select: { id: true },
      });
      // Never overwrite a template an admin may have edited — only fill gaps.
      if (!existing) {
        await prisma.checklistTemplate.create({
          data: { tenantId, category, kind: spec.kind, name: spec.name, items: spec.items as unknown as Prisma.InputJsonValue },
        });
      }
      templates += 1;
    }
  }
  console.info(`  ✓ Checklist templates: ${templates}`);

  for (const tpl of REPAIR_NOTIFICATION_TEMPLATES) {
    await prisma.notificationTemplate.upsert({
      where: { key_channel_locale: { key: tpl.key, channel: tpl.channel, locale: 'en-IN' } },
      update: { body: tpl.body, isActive: true },
      create: { key: tpl.key, channel: tpl.channel, body: tpl.body, locale: 'en-IN' },
    });
  }
  console.info(`  ✓ Repair notification templates: ${REPAIR_NOTIFICATION_TEMPLATES.length}`);
}
