import { UnauthorizedException } from '@nestjs/common';

import { JwtAuthGuard } from './jwt.guard';

function build(opts: { sessionActive?: boolean; roles?: string[] } = {}) {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
  const tokens = { verifyAccess: jest.fn().mockResolvedValue({ sub: 'u1', tid: 't1', sid: 's1', pv: 1, iat: 0, exp: 9e9 }) };
  const permissions = {
    loadForUser: jest.fn().mockResolvedValue({ roles: opts.roles ?? ['ADMIN'], permissions: [] }),
    isSessionActive: jest.fn().mockResolvedValue(opts.sessionActive ?? true),
  };
  const rbac = { getTenantRbacVersion: jest.fn().mockResolvedValue(1) };
  const cls = { set: jest.fn() };
  const guard = new JwtAuthGuard(reflector as never, tokens as never, permissions as never, rbac as never, cls as never);
  const req: { headers: Record<string, string>; user?: unknown } = { headers: { authorization: 'Bearer t' } };
  const ctx = { getHandler: () => null, getClass: () => null, switchToHttp: () => ({ getRequest: () => req }) };
  return { guard, ctx: ctx as never, req };
}

describe('JwtAuthGuard session checks', () => {
  it('lets an active session through', async () => {
    const { guard, ctx, req } = build();
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req.user).toMatchObject({ userId: 'u1', sessionId: 's1' });
  });

  it('rejects a revoked session even with a valid access token', async () => {
    const { guard, ctx } = build({ sessionActive: false });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a suspended or deleted user (no roles loaded)', async () => {
    const { guard, ctx } = build({ roles: [] });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
