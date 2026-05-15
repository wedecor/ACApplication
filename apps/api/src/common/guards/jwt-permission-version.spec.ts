import { ApiErrorCode } from '@ac/types';

import { PermissionsStaleException } from '../exceptions/permissions-stale.exception';

describe('PermissionsStaleException', () => {
  it('uses PERMISSIONS_STALE error code', () => {
    const ex = new PermissionsStaleException();
    const resp = ex.getResponse() as { code: string };
    expect(resp.code).toBe(ApiErrorCode.PERMISSIONS_STALE);
  });
});
