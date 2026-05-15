import { ForbiddenException } from '@nestjs/common';

import { assertTenantMatch } from '../../../common/tenant/tenant-scope';

describe('tracking tenant isolation', () => {
  it('rejects cross-tenant technician access', () => {
    expect(() => assertTenantMatch({ tenantId: 'tenant-b' }, 'tenant-a', 'Technician')).toThrow(
      ForbiddenException,
    );
  });
});
