import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { assertTenantMatch } from './tenant-scope';

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
