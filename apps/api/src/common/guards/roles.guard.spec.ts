import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ALLOW_AUTHENTICATED_KEY, IS_PUBLIC_KEY, PERMS_KEY } from '../decorators';
import { RolesGuard } from './roles.guard';

describe('RolesGuard (deny-by-default)', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  const guard = new RolesGuard(reflector);

  const ctx = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user: { userId: 'u1', tenantId: 't1', roles: [], permissions: [] } }),
    }),
  } as never;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('allows @Public routes', () => {
    (reflector.getAllAndOverride as jest.Mock).mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return true;
      return undefined;
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows @AllowAuthenticated without permissions', () => {
    (reflector.getAllAndOverride as jest.Mock).mockImplementation((key: string) => {
      if (key === ALLOW_AUTHENTICATED_KEY) return true;
      return undefined;
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('denies routes with no permission metadata', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
