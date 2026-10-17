/**
 * Pure per-row mapping + validation for CSV imports. DB-dependent checks
 * (duplicates, customer resolution, custom-field definitions) happen in
 * `DataImportService`.
 */

import { $Enums } from '@prisma/client';

import { normalizePhoneE164 } from '../customers/phone';

export const IMPORT_ENTITIES = ['customers', 'leads', 'appliances'] as const;
export type ImportEntity = (typeof IMPORT_ENTITIES)[number];

export interface RowError {
  row: number;
  field?: string;
  message: string;
}

export const HEADER_ALIASES: Record<ImportEntity, Record<string, string[]>> = {
  customers: {
    fullName: ['name', 'customer name', 'full name', 'customer'],
    phone: ['mobile', 'phone number', 'contact', 'mobile number'],
    email: ['email address', 'e-mail'],
    city: ['city name'],
    cityId: [],
    tags: ['tag', 'labels'],
    preferredLanguage: ['language', 'lang'],
  },
  leads: {
    customerName: ['name', 'full name', 'customer'],
    phone: ['mobile', 'phone number', 'contact'],
    whatsappNumber: ['whatsapp'],
    email: ['email address'],
    source: ['lead source'],
    applianceType: ['category', 'appliance', 'service category'],
    applianceBrand: ['brand'],
    issueDescription: ['issue', 'problem', 'description'],
    addressLine1: ['address', 'address line 1'],
    city: ['city name'],
    cityId: [],
    pincode: ['pin', 'pin code', 'zip', 'postal code'],
    priority: [],
    tags: ['tag', 'labels'],
  },
  appliances: {
    customerPhone: ['phone', 'mobile', 'customer mobile'],
    category: ['appliance', 'type', 'appliance type'],
    brand: ['make'],
    modelNumber: ['model', 'model no'],
    serialNumber: ['serial', 'serial no'],
    capacity: [],
    installedLocation: ['location', 'room'],
    purchaseDate: ['purchased on'],
    installDate: ['installed on'],
    manufacturerWarrantyUntil: ['warranty until', 'warranty expiry'],
    extendedWarrantyUntil: ['extended warranty until'],
    warrantyProvider: [],
    notes: ['remarks'],
  },
};

export const TEMPLATE_EXAMPLES: Record<ImportEntity, Record<string, string>> = {
  customers: {
    fullName: 'Priya Sharma',
    phone: '9876543210',
    email: 'priya@example.com',
    city: 'Bengaluru',
    tags: 'vip;society-a',
    preferredLanguage: 'en',
  },
  leads: {
    customerName: 'Rahul Verma',
    phone: '9876501234',
    email: '',
    source: 'MANUAL',
    applianceType: 'AC_REPAIR',
    applianceBrand: 'Daikin',
    issueDescription: 'Not cooling',
    addressLine1: '12 MG Road',
    city: 'Bengaluru',
    pincode: '560001',
    priority: 'NORMAL',
    tags: '',
  },
  appliances: {
    customerPhone: '9876543210',
    category: 'AC_SERVICING',
    brand: 'LG',
    modelNumber: 'LS-Q18',
    serialNumber: 'SN123456',
    capacity: '1.5 Ton',
    installedLocation: 'Bedroom',
    purchaseDate: '2024-04-01',
    installDate: '2024-04-03',
    manufacturerWarrantyUntil: '2026-04-01',
    extendedWarrantyUntil: '',
    warrantyProvider: '',
    notes: '',
  },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function splitTags(raw: string | undefined): string[] {
  if (!raw) return [];
  return [...new Set(raw.split(/[;,|]/).map((t) => t.trim().toLowerCase()).filter(Boolean))];
}

export function extractCustomFields(rec: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(rec)) if (k.startsWith('cf_')) out[k.slice(3)] = v;
  return out;
}

function parseDate(raw: string | undefined, field: string, row: number, errors: RowError[]) {
  if (!raw) return null;
  // Accept ISO (2024-04-01) and Indian DD/MM/YYYY or DD-MM-YYYY.
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(raw);
  const d = dmy ? new Date(Date.UTC(+dmy[3]!, +dmy[2]! - 1, +dmy[1]!)) : new Date(raw);
  if (Number.isNaN(d.getTime())) {
    errors.push({ row, field, message: `Invalid date "${raw}"` });
    return null;
  }
  return d;
}

function enumValue<T extends string>(
  values: Record<string, T>,
  raw: string | undefined,
  field: string,
  row: number,
  errors: RowError[],
): T | undefined {
  if (!raw) return undefined;
  const v = raw.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if ((Object.values(values) as string[]).includes(v)) return v as T;
  errors.push({ row, field, message: `Invalid ${field} "${raw}"` });
  return undefined;
}

export type CityLookup = (nameOrId: { city?: string; cityId?: string }) => string | null | undefined;

function resolveCity(
  rec: Record<string, string>,
  cities: CityLookup,
  row: number,
  errors: RowError[],
): string | null {
  if (!rec.city && !rec.cityId) return null;
  const id = cities({ city: rec.city, cityId: rec.cityId });
  if (!id) {
    errors.push({ row, field: 'city', message: `Unknown city "${rec.city ?? rec.cityId}"` });
    return null;
  }
  return id;
}

export interface CustomerRow {
  fullName: string;
  phone: string;
  email: string | null;
  cityId: string | null;
  tags: string[];
  preferredLanguage?: string;
  customFields: Record<string, string>;
}

export function buildCustomerRow(
  rec: Record<string, string>,
  row: number,
  cities: CityLookup,
): { value?: CustomerRow; errors: RowError[] } {
  const errors: RowError[] = [];
  const fullName = rec.fullName;
  if (!fullName || fullName.length < 2) errors.push({ row, field: 'fullName', message: 'Name is required' });
  const phone = normalizePhoneE164(rec.phone);
  if (!phone) errors.push({ row, field: 'phone', message: `Invalid phone "${rec.phone ?? ''}"` });
  const email = rec.email?.toLowerCase() ?? null;
  if (email && !EMAIL_RE.test(email)) errors.push({ row, field: 'email', message: 'Invalid email' });
  const cityId = resolveCity(rec, cities, row, errors);
  if (errors.length) return { errors };
  return {
    errors,
    value: {
      fullName: fullName!,
      phone: phone!,
      email,
      cityId,
      tags: splitTags(rec.tags),
      preferredLanguage: rec.preferredLanguage,
      customFields: extractCustomFields(rec),
    },
  };
}

export interface LeadRow {
  customerName: string;
  phone: string;
  whatsappNumber: string | null;
  email: string | null;
  source: $Enums.LeadSource;
  applianceType: $Enums.ServiceCategory | null;
  applianceBrand: string | null;
  issueDescription: string | null;
  addressLine1: string | null;
  cityId: string | null;
  cityLabel: string | null;
  pincode: string | null;
  priority: $Enums.LeadPriority;
  tags: string[];
  customFields: Record<string, string>;
}

export function buildLeadRow(
  rec: Record<string, string>,
  row: number,
  cities: CityLookup,
): { value?: LeadRow; errors: RowError[] } {
  const errors: RowError[] = [];
  const customerName = rec.customerName;
  if (!customerName) errors.push({ row, field: 'customerName', message: 'Name is required' });
  const phone = normalizePhoneE164(rec.phone);
  if (!phone) errors.push({ row, field: 'phone', message: `Invalid phone "${rec.phone ?? ''}"` });
  const whatsapp = rec.whatsappNumber ? normalizePhoneE164(rec.whatsappNumber) : null;
  if (rec.whatsappNumber && !whatsapp) {
    errors.push({ row, field: 'whatsappNumber', message: 'Invalid WhatsApp number' });
  }
  const email = rec.email?.toLowerCase() ?? null;
  if (email && !EMAIL_RE.test(email)) errors.push({ row, field: 'email', message: 'Invalid email' });
  const source = enumValue($Enums.LeadSource, rec.source, 'source', row, errors);
  const applianceType = enumValue($Enums.ServiceCategory, rec.applianceType, 'applianceType', row, errors);
  const priority = enumValue($Enums.LeadPriority, rec.priority, 'priority', row, errors);
  const pincode = rec.pincode ?? null;
  if (pincode && !/^\d{6}$/.test(pincode)) errors.push({ row, field: 'pincode', message: 'Pincode must be 6 digits' });
  // Unknown city names are kept as a free-text label rather than rejected.
  const cityId = rec.city || rec.cityId ? (cities({ city: rec.city, cityId: rec.cityId }) ?? null) : null;
  if (rec.cityId && !cityId) errors.push({ row, field: 'cityId', message: 'Unknown cityId' });
  if (errors.length) return { errors };
  return {
    errors,
    value: {
      customerName: customerName!,
      phone: phone!,
      whatsappNumber: whatsapp,
      email,
      source: source ?? 'MANUAL',
      applianceType: applianceType ?? null,
      applianceBrand: rec.applianceBrand ?? null,
      issueDescription: rec.issueDescription ?? null,
      addressLine1: rec.addressLine1 ?? null,
      cityId,
      cityLabel: rec.city ?? null,
      pincode,
      priority: priority ?? 'NORMAL',
      tags: splitTags(rec.tags),
      customFields: extractCustomFields(rec),
    },
  };
}

export interface ApplianceRow {
  customerPhone: string;
  category: $Enums.ServiceCategory;
  brand: string;
  modelNumber: string | null;
  serialNumber: string | null;
  capacity: string | null;
  installedLocation: string | null;
  purchaseDate: Date | null;
  installDate: Date | null;
  manufacturerWarrantyUntil: Date | null;
  extendedWarrantyUntil: Date | null;
  warrantyProvider: string | null;
  notes: string | null;
  customFields: Record<string, string>;
}

export function buildApplianceRow(
  rec: Record<string, string>,
  row: number,
): { value?: ApplianceRow; errors: RowError[] } {
  const errors: RowError[] = [];
  const customerPhone = normalizePhoneE164(rec.customerPhone);
  if (!customerPhone) {
    errors.push({ row, field: 'customerPhone', message: `Invalid phone "${rec.customerPhone ?? ''}"` });
  }
  if (!rec.category) errors.push({ row, field: 'category', message: 'Category is required' });
  const category = enumValue($Enums.ServiceCategory, rec.category, 'category', row, errors);
  if (!rec.brand) errors.push({ row, field: 'brand', message: 'Brand is required' });
  const purchaseDate = parseDate(rec.purchaseDate, 'purchaseDate', row, errors);
  const installDate = parseDate(rec.installDate, 'installDate', row, errors);
  const mfr = parseDate(rec.manufacturerWarrantyUntil, 'manufacturerWarrantyUntil', row, errors);
  const ext = parseDate(rec.extendedWarrantyUntil, 'extendedWarrantyUntil', row, errors);
  if (errors.length || !category) return { errors };
  return {
    errors,
    value: {
      customerPhone: customerPhone!,
      category,
      brand: rec.brand!,
      modelNumber: rec.modelNumber ?? null,
      serialNumber: rec.serialNumber ?? null,
      capacity: rec.capacity ?? null,
      installedLocation: rec.installedLocation ?? null,
      purchaseDate,
      installDate,
      manufacturerWarrantyUntil: mfr,
      extendedWarrantyUntil: ext,
      warrantyProvider: rec.warrantyProvider ?? null,
      notes: rec.notes ?? null,
      customFields: extractCustomFields(rec),
    },
  };
}
