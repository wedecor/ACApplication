import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { assertIdsInTenant,assertTenantMatch } from './tenant-scope';

describe('assertTenantMatch', () => {
  it('throws NotFound when row is missing', () => {
    expect(() => assertTenantMatch(null, 'tenant-a')).toThrow(NotFoundException);
  });

  it('throws Forbidden on tenant mismatch', () => {
    expect(() => assertTenantMatch({ tenantId: 'tenant-b' }, 'tenant-a')).toThrow(ForbiddenException);
  });

  it('passes when tenant matches', () => {
    expect(() => assertTenantMatch({ tenantId: 'tenant-a' }, 'tenant-a')).not.toThrow();
  });
});

describe('assertIdsInTenant', () => {

  it('checks every provided id against the tenant and skips empty ones', async () => {
    const city = { findFirst: jest.fn().mockResolvedValue({ id: 'c1' }) };
    const lead = { findFirst: jest.fn() };
    await assertIdsInTenant({ city, lead }, 't1', [
      ['city', 'c1', 'City'],
      ['lead', undefined, 'Lead'],
    ]);
    expect(city.findFirst).toHaveBeenCalledWith({ where: { id: 'c1', tenantId: 't1' }, select: { id: true } });
    expect(lead.findFirst).not.toHaveBeenCalled();
  });

  it('404s when an id belongs to another tenant', async () => {
    const city = { findFirst: jest.fn().mockResolvedValue(null) };
    await expect(assertIdsInTenant({ city }, 't1', [['city', 'c_other', 'City']])).rejects.toThrow('City not found');
  });
});
