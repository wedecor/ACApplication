import { UnauthorizedException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';

import { AuthService } from '../auth.service';

function build(current: Record<string, unknown> | null, previous: Record<string, unknown> | null = null) {
  const session = {
    findFirst: jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
      'previousRefreshTokenHash' in where ? previous : current,
    ),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  };
  const svc = new AuthService({} as never, {} as never, { client: { session } } as never, {} as never);
  jest.spyOn(svc as never, 'issueSessionForUser' as never).mockResolvedValue({ accessToken: 'a' } as never);
  return { svc, session };
}

const activeSession = {
  id: 's1',
  device: 'ADMIN_WEB',
  user: { id: 'u1', deletedAt: null, status: UserStatus.ACTIVE, roles: [] },
};

describe('AuthService.refreshWithOpaqueToken', () => {
  it('rotates with a compare-and-swap on the presented token and remembers the old hash', async () => {
    const { svc, session } = build(activeSession);
    await svc.refreshWithOpaqueToken('a'.repeat(40));
    const args = session.updateMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ id: 's1', revokedAt: null });
    expect(args.where.refreshTokenHash).toBe(args.data.previousRefreshTokenHash);
    expect(args.data.refreshRotatedAt).toBeInstanceOf(Date);
  });

  it('rejects the loser of a concurrent refresh', async () => {
    const { svc, session } = build(activeSession);
    session.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(svc.refreshWithOpaqueToken('a'.repeat(40))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('revokes the session when an old token is replayed after the grace window', async () => {
    const { svc, session } = build(null, { id: 's1', userId: 'u1', refreshRotatedAt: new Date(Date.now() - 60_000) });
    await expect(svc.refreshWithOpaqueToken('b'.repeat(40))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(session.updateMany).toHaveBeenCalledWith({ where: { id: 's1', revokedAt: null }, data: { revokedAt: expect.any(Date) } });
  });

  it('tolerates an old token inside the grace window (two tabs refreshing)', async () => {
    const { svc, session } = build(null, { id: 's1', userId: 'u1', refreshRotatedAt: new Date() });
    await expect(svc.refreshWithOpaqueToken('b'.repeat(40))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(session.updateMany).not.toHaveBeenCalled();
  });
});
