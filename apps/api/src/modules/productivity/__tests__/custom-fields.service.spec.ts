import { BadRequestException } from '@nestjs/common';

import { type CustomFieldDef,CustomFieldsService, validateAgainstDefinitions } from '../custom-fields.service';

const defs: CustomFieldDef[] = [
  { key: 'block', label: 'Block', fieldType: 'text', options: [], required: true, isActive: true },
  { key: 'floors', label: 'Floors', fieldType: 'number', options: [], required: false, isActive: true },
  { key: 'vip', label: 'VIP', fieldType: 'boolean', options: [], required: false, isActive: true },
  { key: 'since', label: 'Since', fieldType: 'date', options: [], required: false, isActive: true },
  { key: 'tier', label: 'Tier', fieldType: 'select', options: ['gold', 'silver'], required: false, isActive: true },
  { key: 'legacy', label: 'Legacy', fieldType: 'text', options: [], required: true, isActive: false },
];

describe('validateAgainstDefinitions', () => {
  it('coerces values to canonical types', () => {
    const { value, errors } = validateAgainstDefinitions(defs, {
      block: ' A ',
      floors: '12',
      vip: 'true',
      since: '2024-03-01',
      tier: 'gold',
    });
    expect(errors).toEqual([]);
    expect(value).toEqual({
      block: 'A',
      floors: 12,
      vip: true,
      since: '2024-03-01T00:00:00.000Z',
      tier: 'gold',
    });
  });

  it('rejects unknown keys, bad types and options', () => {
    const { errors } = validateAgainstDefinitions(defs, {
      block: 'A',
      nope: 1,
      floors: 'abc',
      vip: 'maybe',
      since: 'not a date',
      tier: 'bronze',
    });
    expect(errors.map((e) => e.key).sort()).toEqual(['floors', 'nope', 'since', 'tier', 'vip']);
  });

  it('enforces required active fields unless partial', () => {
    expect(validateAgainstDefinitions(defs, {}).errors).toEqual([
      { key: 'block', message: 'Block is required' },
    ]);
    const partial = validateAgainstDefinitions(defs, { floors: '' }, { partial: true });
    expect(partial.errors).toEqual([]);
    expect(partial.value).toEqual({ floors: null });
  });

  it('rejects non-object input', () => {
    expect(validateAgainstDefinitions(defs, ['x']).errors[0]!.key).toBe('*');
  });
});

describe('CustomFieldsService.validateCustomFields', () => {
  it('throws BadRequestException with error list', async () => {
    const prisma = { client: { customFieldDefinition: { findMany: jest.fn().mockResolvedValue(defs) } } };
    const service = new CustomFieldsService(prisma as never);
    await expect(service.validateCustomFields('t1', 'customer', { floors: 2 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.validateCustomFields('t1', 'customer', { block: 'B' }),
    ).resolves.toEqual({ block: 'B' });
    expect(prisma.client.customFieldDefinition.findMany.mock.calls[0][0].where).toEqual({
      tenantId: 't1',
      entity: 'customer',
      deletedAt: null,
    });
  });
});
