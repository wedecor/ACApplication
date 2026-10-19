import type { AuthPrincipal } from '@ac/auth';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import type {
  CreateCustomFieldDto,
  CustomFieldEntity,
  ListCustomFieldsDto,
  UpdateCustomFieldDto,
} from './dto/custom-field.dto';

export interface CustomFieldDef {
  key: string;
  label: string;
  fieldType: string;
  options: unknown;
  required: boolean;
  isActive: boolean;
}

export interface CustomFieldError {
  key: string;
  message: string;
}

export interface ValidateOptions {
  /** Partial update: skip `required` checks; `null`/'' values are returned as null (clear). */
  partial?: boolean;
}

function optionList(options: unknown): string[] {
  return Array.isArray(options) ? options.filter((o): o is string => typeof o === 'string') : [];
}

function isUnset(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
}

function coerce(def: CustomFieldDef, raw: unknown): { ok: true; value: unknown } | { ok: false; message: string } {
  switch (def.fieldType) {
    case 'text': {
      if (typeof raw === 'number' || typeof raw === 'boolean') return { ok: true, value: String(raw) };
      if (typeof raw !== 'string') return { ok: false, message: 'must be text' };
      if (raw.length > 2000) return { ok: false, message: 'must be at most 2000 characters' };
      return { ok: true, value: raw.trim() };
    }
    case 'number': {
      const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw.trim()) : NaN;
      if (!Number.isFinite(n)) return { ok: false, message: 'must be a number' };
      return { ok: true, value: n };
    }
    case 'boolean': {
      if (typeof raw === 'boolean') return { ok: true, value: raw };
      if (typeof raw === 'string') {
        const s = raw.trim().toLowerCase();
        if (['true', '1', 'yes'].includes(s)) return { ok: true, value: true };
        if (['false', '0', 'no'].includes(s)) return { ok: true, value: false };
      }
      return { ok: false, message: 'must be true or false' };
    }
    case 'date': {
      if (typeof raw !== 'string' && !(raw instanceof Date)) return { ok: false, message: 'must be a date' };
      const d = raw instanceof Date ? raw : new Date(raw.trim());
      if (Number.isNaN(d.getTime())) return { ok: false, message: 'must be a valid date' };
      return { ok: true, value: d.toISOString() };
    }
    case 'select': {
      const opts = optionList(def.options);
      const s = typeof raw === 'string' ? raw.trim() : typeof raw === 'number' ? String(raw) : null;
      if (s === null || !opts.includes(s)) {
        return { ok: false, message: `must be one of: ${opts.join(', ')}` };
      }
      return { ok: true, value: s };
    }
    default:
      return { ok: false, message: `unsupported field type ${def.fieldType}` };
  }
}

/**
 * Pure validator: checks `values` against `defs`. Unknown keys are rejected,
 * required (active) fields enforced unless `partial`, values coerced to their
 * canonical JSON form.
 */
export function validateAgainstDefinitions(
  defs: CustomFieldDef[],
  values: unknown,
  opts: ValidateOptions = {},
): { value: Record<string, unknown>; errors: CustomFieldError[] } {
  const errors: CustomFieldError[] = [];
  const out: Record<string, unknown> = {};
  if (values !== undefined && values !== null && (typeof values !== 'object' || Array.isArray(values))) {
    return { value: out, errors: [{ key: '*', message: 'customFields must be an object' }] };
  }
  const input = (values ?? {}) as Record<string, unknown>;
  const byKey = new Map(defs.map((d) => [d.key, d]));

  for (const [key, raw] of Object.entries(input)) {
    const def = byKey.get(key);
    if (!def) {
      errors.push({ key, message: 'unknown custom field' });
      continue;
    }
    if (isUnset(raw)) {
      if (opts.partial) out[key] = null;
      continue;
    }
    const res = coerce(def, raw);
    if (res.ok) out[key] = res.value;
    else errors.push({ key, message: `${def.label} ${res.message}` });
  }

  if (!opts.partial) {
    for (const def of defs) {
      if (def.required && def.isActive && isUnset(input[def.key])) {
        errors.push({ key: def.key, message: `${def.label} is required` });
      }
    }
  }
  return { value: out, errors };
}

@Injectable()
export class CustomFieldsService {
  constructor(private readonly prisma: PrismaService) {}

  list(actor: AuthPrincipal, query: ListCustomFieldsDto) {
    return this.prisma.client.customFieldDefinition.findMany({
      where: {
        tenantId: actor.tenantId,
        deletedAt: null,
        ...(query.entity ? { entity: query.entity } : {}),
        ...(query.includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ entity: 'asc' }, { sortOrder: 'asc' }, { label: 'asc' }],
    });
  }

  async create(actor: AuthPrincipal, dto: CreateCustomFieldDto) {
    this.assertOptions(dto.fieldType, dto.options);
    const existing = await this.prisma.client.customFieldDefinition.findFirst({
      where: { tenantId: actor.tenantId, entity: dto.entity, key: dto.key },
    });
    if (existing && !existing.deletedAt) {
      throw new ConflictException(`Custom field "${dto.key}" already exists for ${dto.entity}`);
    }
    const data = {
      label: dto.label.trim(),
      fieldType: dto.fieldType,
      options: (dto.options ?? []) as Prisma.InputJsonValue,
      required: dto.required ?? false,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
      updatedBy: actor.userId,
    };
    if (existing) {
      // Revive a previously deleted definition (unique on tenant+entity+key).
      return this.prisma.client.customFieldDefinition.update({
        where: { id: existing.id },
        data: { ...data, deletedAt: null, deletedBy: null },
      });
    }
    return this.prisma.client.customFieldDefinition.create({
      data: {
        ...data,
        tenantId: actor.tenantId,
        entity: dto.entity,
        key: dto.key,
        createdBy: actor.userId,
      },
    });
  }

  async update(actor: AuthPrincipal, id: string, dto: UpdateCustomFieldDto) {
    const current = await this.findOrThrow(actor.tenantId, id);
    const fieldType = dto.fieldType ?? current.fieldType;
    const options = dto.options ?? optionList(current.options);
    this.assertOptions(fieldType, options);
    return this.prisma.client.customFieldDefinition.update({
      where: { id },
      data: {
        ...(dto.label !== undefined ? { label: dto.label.trim() } : {}),
        ...(dto.fieldType !== undefined ? { fieldType: dto.fieldType } : {}),
        ...(dto.options !== undefined ? { options: dto.options } : {}),
        ...(dto.required !== undefined ? { required: dto.required } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        updatedBy: actor.userId,
      },
    });
  }

  async remove(actor: AuthPrincipal, id: string) {
    await this.findOrThrow(actor.tenantId, id);
    await this.prisma.client.customFieldDefinition.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: actor.userId, isActive: false },
    });
    return { ok: true as const };
  }

  /**
   * Validate + normalise custom field values for an entity. Reusable by any
   * module (customers, leads, bookings, data import). Throws a
   * `BadRequestException` with `{ message, errors }` on failure.
   */
  async validateCustomFields(
    tenantId: string,
    entity: CustomFieldEntity,
    values: unknown,
    opts: ValidateOptions = {},
  ): Promise<Record<string, unknown>> {
    const { value, errors } = await this.check(tenantId, entity, values, opts);
    if (errors.length) {
      throw new BadRequestException({ message: 'Invalid custom fields', errors });
    }
    return value;
  }

  /** Non-throwing variant for bulk import row reports. */
  async check(
    tenantId: string,
    entity: CustomFieldEntity,
    values: unknown,
    opts: ValidateOptions = {},
  ) {
    const defs = await this.definitionsFor(tenantId, entity);
    return validateAgainstDefinitions(defs, values, opts);
  }

  definitionsFor(tenantId: string, entity: CustomFieldEntity): Promise<CustomFieldDef[]> {
    return this.prisma.client.customFieldDefinition.findMany({
      where: { tenantId, entity, deletedAt: null },
      select: { key: true, label: true, fieldType: true, options: true, required: true, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  private assertOptions(fieldType: string, options: string[] | undefined) {
    if (fieldType === 'select' && (!options || options.length === 0)) {
      throw new BadRequestException('select fields require at least one option');
    }
  }

  private async findOrThrow(tenantId: string, id: string) {
    const row = await this.prisma.client.customFieldDefinition.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Custom field not found');
    return row;
  }
}
