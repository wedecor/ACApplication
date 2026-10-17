import { BadRequestException, HttpException, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { CustomersService } from '../customers/customers.service';
import { phoneVariants } from '../customers/phone';
import { LeadsRepository } from '../leads/leads.repository';
import {
  type CustomFieldDef,
  CustomFieldsService,
  validateAgainstDefinitions,
} from '../productivity/custom-fields.service';
import { parseCsv, rowsToRecords, toCsvRow } from './csv';
import {
  type ApplianceRow,
  buildApplianceRow,
  buildCustomerRow,
  buildLeadRow,
  type CityLookup,
  type CustomerRow,
  HEADER_ALIASES,
  IMPORT_ENTITIES,
  type ImportEntity,
  type LeadRow,
  type RowError,
  TEMPLATE_EXAMPLES,
} from './import-rows';

export const MAX_IMPORT_ROWS = 5000;
/** A lead with the same phone inside this window counts as a duplicate. */
const LEAD_DUPLICATE_WINDOW_DAYS = 30;

export interface DuplicateRow {
  row: number;
  existingId: string | null;
  reason: string;
}

export interface ImportReport {
  entity: ImportEntity;
  dryRun: boolean;
  total: number;
  valid: number;
  created: number;
  skipped: number;
  errors: RowError[];
  duplicates: DuplicateRow[];
}

interface Pending<T> {
  row: number;
  value: T;
  customFields: Record<string, unknown>;
}

/** Spreadsheet line number of a data record (header is line 1). */
const lineOf = (idx: number) => idx + 2;
const tail10 = (p: string) => p.replace(/\D/g, '').slice(-10);

@Injectable()
export class DataImportService {
  private readonly logger = new Logger(DataImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly customers: CustomersService,
    private readonly leads: LeadsRepository,
    private readonly customFields: CustomFieldsService,
  ) {}

  isEntity(entity: string): entity is ImportEntity {
    return (IMPORT_ENTITIES as readonly string[]).includes(entity);
  }

  template(entity: string): string {
    if (!this.isEntity(entity)) throw new BadRequestException(`Unsupported import entity: ${entity}`);
    const example = TEMPLATE_EXAMPLES[entity];
    return toCsvRow(Object.keys(example)) + toCsvRow(Object.values(example));
  }

  async run(
    tenantId: string,
    actorUserId: string,
    entity: string,
    csv: string,
    dryRun: boolean,
  ): Promise<ImportReport> {
    if (!this.isEntity(entity)) throw new BadRequestException(`Unsupported import entity: ${entity}`);
    const rows = parseCsv(csv);
    const { headers, records } = rowsToRecords(rows, HEADER_ALIASES[entity]);
    if (!headers.length) throw new BadRequestException('CSV is empty');
    if (records.length > MAX_IMPORT_ROWS) {
      throw new BadRequestException(`At most ${MAX_IMPORT_ROWS} rows per import`);
    }

    const report: ImportReport = {
      entity,
      dryRun,
      total: records.length,
      valid: 0,
      created: 0,
      skipped: 0,
      errors: [],
      duplicates: [],
    };

    switch (entity) {
      case 'customers':
        await this.importCustomers(tenantId, actorUserId, records, dryRun, report);
        break;
      case 'leads':
        await this.importLeads(tenantId, actorUserId, records, dryRun, report);
        break;
      case 'appliances':
        await this.importAppliances(tenantId, actorUserId, records, dryRun, report);
        break;
    }
    report.skipped = report.total - (dryRun ? report.valid : report.created);
    this.logger.log(
      { tenantId, entity, dryRun, total: report.total, created: report.created },
      'data.import',
    );
    return report;
  }

  // -------------------------------------------------------------- customers
  private async importCustomers(
    tenantId: string,
    actorUserId: string,
    records: Record<string, string>[],
    dryRun: boolean,
    report: ImportReport,
  ) {
    const cities = await this.cityLookup(tenantId);
    const defs = await this.customFields.definitionsFor(tenantId, 'customer');
    const pending = this.validateRows(records, report, defs, (rec, row) =>
      buildCustomerRow(rec, row, cities),
    );

    const unique = this.dedupeInFile(pending, (p) => tail10(p.value.phone), report, 'phone repeated in file');
    const existing = await this.existingCustomersByPhone(
      tenantId,
      unique.map((p) => p.value.phone),
    );
    const emails = unique.map((p) => p.value.email).filter((e): e is string => !!e);
    const existingEmails = emails.length
      ? await this.prisma.client.user.findMany({
          where: { email: { in: emails } },
          select: { email: true, customer: { select: { id: true } } },
        })
      : [];
    const emailMap = new Map(existingEmails.map((u) => [u.email!, u.customer?.id ?? null]));

    const toCreate: Pending<CustomerRow>[] = [];
    for (const p of unique) {
      const byPhone = existing.get(tail10(p.value.phone));
      if (byPhone) {
        report.duplicates.push({ row: p.row, existingId: byPhone, reason: 'phone' });
      } else if (p.value.email && emailMap.has(p.value.email)) {
        report.duplicates.push({ row: p.row, existingId: emailMap.get(p.value.email) ?? null, reason: 'email' });
      } else {
        toCreate.push(p);
      }
    }
    report.valid = toCreate.length;
    if (dryRun) return;

    for (const p of toCreate) {
      try {
        await this.customers.createForTenant(tenantId, actorUserId, {
          fullName: p.value.fullName,
          phone: p.value.phone,
          email: p.value.email,
          cityId: p.value.cityId,
          tags: p.value.tags,
          customFields: p.customFields,
          preferredLanguage: p.value.preferredLanguage,
        });
        report.created++;
      } catch (err) {
        report.errors.push({ row: p.row, message: this.errorMessage(err) });
      }
    }
  }

  // ------------------------------------------------------------------ leads
  private async importLeads(
    tenantId: string,
    actorUserId: string,
    records: Record<string, string>[],
    dryRun: boolean,
    report: ImportReport,
  ) {
    const cities = await this.cityLookup(tenantId);
    const defs = await this.customFields.definitionsFor(tenantId, 'lead');
    const pending = this.validateRows(records, report, defs, (rec, row) => buildLeadRow(rec, row, cities));
    const unique = this.dedupeInFile(pending, (p) => tail10(p.value.phone), report, 'phone repeated in file');

    const since = new Date(Date.now() - LEAD_DUPLICATE_WINDOW_DAYS * 86_400_000);
    const phones = unique.flatMap((p) => phoneVariants(p.value.phone));
    const recent = phones.length
      ? await this.prisma.client.lead.findMany({
          where: {
            tenantId,
            deletedAt: null,
            createdAt: { gte: since },
            status: { not: 'CANCELLED' },
            phone: { in: phones },
          },
          select: { id: true, phone: true },
        })
      : [];
    const recentMap = new Map(recent.map((l) => [tail10(l.phone), l.id]));

    const toCreate: Pending<LeadRow>[] = [];
    for (const p of unique) {
      const dup = recentMap.get(tail10(p.value.phone));
      if (dup) report.duplicates.push({ row: p.row, existingId: dup, reason: 'recent lead with same phone' });
      else toCreate.push(p);
    }
    report.valid = toCreate.length;
    if (dryRun) return;

    for (const p of toCreate) {
      try {
        const code = await this.leads.nextCode(tenantId);
        const v = p.value;
        await this.prisma.client.lead.create({
          data: {
            tenantId,
            code,
            customerName: v.customerName,
            phone: v.phone,
            whatsappNumber: v.whatsappNumber,
            email: v.email,
            source: v.source,
            applianceType: v.applianceType,
            applianceBrand: v.applianceBrand,
            issueDescription: v.issueDescription,
            addressLine1: v.addressLine1,
            cityId: v.cityId,
            cityLabel: v.cityLabel,
            pincode: v.pincode,
            priority: v.priority,
            tags: v.tags,
            customFields: p.customFields as Prisma.InputJsonValue,
            metadata: { importedAt: new Date().toISOString() },
            createdBy: actorUserId,
            updatedBy: actorUserId,
          },
        });
        report.created++;
      } catch (err) {
        report.errors.push({ row: p.row, message: this.errorMessage(err) });
      }
    }
  }

  // ------------------------------------------------------------- appliances
  private async importAppliances(
    tenantId: string,
    actorUserId: string,
    records: Record<string, string>[],
    dryRun: boolean,
    report: ImportReport,
  ) {
    const defs = await this.customFields.definitionsFor(tenantId, 'appliance');
    const pending = this.validateRows(records, report, defs, (rec, row) => buildApplianceRow(rec, row));

    const customerByPhone = await this.existingCustomersByPhone(
      tenantId,
      pending.map((p) => p.value.customerPhone),
    );
    const resolved: (Pending<ApplianceRow> & { customerId: string })[] = [];
    for (const p of pending) {
      const customerId = customerByPhone.get(tail10(p.value.customerPhone));
      if (!customerId) {
        report.errors.push({ row: p.row, field: 'customerPhone', message: 'No customer with this phone' });
      } else {
        resolved.push({ ...p, customerId });
      }
    }

    const unique = this.dedupeInFile(
      resolved,
      (p) => (p.value.serialNumber ? `${p.customerId}:${p.value.serialNumber.toLowerCase()}` : null),
      report,
      'serial number repeated in file',
    );
    const serials = unique.map((p) => p.value.serialNumber).filter((s): s is string => !!s);
    const existing = serials.length
      ? await this.prisma.client.customerAppliance.findMany({
          where: {
            tenantId,
            deletedAt: null,
            serialNumber: { in: serials, mode: 'insensitive' },
          },
          select: { id: true, customerId: true, serialNumber: true },
        })
      : [];
    const existingMap = new Map(
      existing.map((a) => [`${a.customerId}:${(a.serialNumber ?? '').toLowerCase()}`, a.id]),
    );

    const toCreate: typeof unique = [];
    for (const p of unique) {
      const key = p.value.serialNumber ? `${p.customerId}:${p.value.serialNumber.toLowerCase()}` : null;
      const dup = key ? existingMap.get(key) : undefined;
      if (dup) report.duplicates.push({ row: p.row, existingId: dup, reason: 'serial number' });
      else toCreate.push(p);
    }
    report.valid = toCreate.length;
    if (dryRun) return;

    for (const p of toCreate) {
      try {
        const { customerPhone: _phone, customFields: _cf, ...v } = p.value;
        await this.prisma.client.customerAppliance.create({
          data: {
            ...v,
            tenantId,
            customerId: p.customerId,
            customFields: p.customFields as Prisma.InputJsonValue,
            createdBy: actorUserId,
            updatedBy: actorUserId,
          },
        });
        report.created++;
      } catch (err) {
        report.errors.push({ row: p.row, message: this.errorMessage(err) });
      }
    }
  }

  // ---------------------------------------------------------------- helpers
  private validateRows<T extends { customFields: Record<string, string> }>(
    records: Record<string, string>[],
    report: ImportReport,
    defs: CustomFieldDef[],
    build: (rec: Record<string, string>, row: number) => { value?: T; errors: RowError[] },
  ): Pending<T>[] {
    const out: Pending<T>[] = [];
    records.forEach((rec, idx) => {
      const row = lineOf(idx);
      const { value, errors } = build(rec, row);
      const cf = validateAgainstDefinitions(defs, value?.customFields ?? {});
      const cfErrors = value
        ? cf.errors.map((e) => ({ row, field: `cf_${e.key}`, message: e.message }))
        : [];
      if (!value || cfErrors.length) {
        report.errors.push(...errors, ...cfErrors);
        return;
      }
      out.push({ row, value, customFields: cf.value });
    });
    return out;
  }

  private dedupeInFile<P extends { row: number }>(
    items: P[],
    keyOf: (p: P) => string | null,
    report: ImportReport,
    reason: string,
  ): P[] {
    const seen = new Map<string, number>();
    const out: P[] = [];
    for (const p of items) {
      const key = keyOf(p);
      if (key && seen.has(key)) {
        report.duplicates.push({ row: p.row, existingId: null, reason: `${reason} (row ${seen.get(key)})` });
        continue;
      }
      if (key) seen.set(key, p.row);
      out.push(p);
    }
    return out;
  }

  /** tail-10-digit phone → customer id, for active (non-merged) customers. */
  private async existingCustomersByPhone(tenantId: string, phones: string[]) {
    const map = new Map<string, string>();
    const variants = [...new Set(phones.flatMap((p) => phoneVariants(p)))];
    for (let i = 0; i < variants.length; i += 1000) {
      const rows = await this.prisma.client.customer.findMany({
        where: {
          tenantId,
          deletedAt: null,
          mergedIntoId: null,
          phone: { in: variants.slice(i, i + 1000) },
        },
        select: { id: true, phone: true },
      });
      for (const r of rows) map.set(tail10(r.phone), r.id);
    }
    return map;
  }

  private async cityLookup(tenantId: string): Promise<CityLookup> {
    const rows = await this.prisma.client.city.findMany({
      where: { tenantId },
      select: { id: true, name: true },
    });
    const byName = new Map(rows.map((c) => [c.name.trim().toLowerCase(), c.id]));
    const ids = new Set(rows.map((c) => c.id));
    return ({ city, cityId }) => {
      if (cityId) return ids.has(cityId) ? cityId : null;
      if (city) return byName.get(city.trim().toLowerCase()) ?? null;
      return null;
    };
  }

  private errorMessage(err: unknown): string {
    if (err instanceof HttpException) {
      const res = err.getResponse();
      if (typeof res === 'string') return res;
      const msg = (res as { message?: unknown }).message;
      return Array.isArray(msg) ? msg.join('; ') : String(msg ?? err.message);
    }
    // Log only the error class/code — Prisma messages can echo row PII.
    const code = (err as { code?: unknown } | null)?.code;
    this.logger.warn({ name: (err as Error | null)?.name, code }, 'Import row failed');
    return 'Could not save row';
  }
}
