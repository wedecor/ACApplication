import { ConflictException } from '@nestjs/common';

import { buildDeviceList, splitFullName, UsersService } from '../users.service';

describe('splitFullName', () => {
  it('splits first / rest', () => {
    expect(splitFullName('  Asha  K Rao ')).toEqual({ firstName: 'Asha', lastName: 'K Rao' });
    expect(splitFullName('Asha')).toEqual({ firstName: 'Asha', lastName: null });
  });
});

describe('buildDeviceList', () => {
  it('merges push metadata and flags the current session first', () => {
    const list = buildDeviceList(
      [
        { id: 's1', deviceId: 'd1', device: 'ANDROID', lastUsedAt: new Date('2026-01-01T00:00:00Z') },
        { id: 's2', deviceId: null, device: 'ADMIN_WEB', lastUsedAt: new Date('2026-01-02T00:00:00Z') },
      ],
      [{ deviceId: 'd1', modelName: 'Pixel 8', platform: 'android', lastSeenAt: new Date('2026-01-03T00:00:00Z') }],
      's1',
    );
    expect(list[0]).toEqual({ id: 's1', deviceId: 'd1', modelName: 'Pixel 8', platform: 'android', lastSeenAt: '2026-01-03T00:00:00.000Z', current: true });
    expect(list[1]).toMatchObject({ id: 's2', deviceId: 's2', modelName: null, current: false });
  });
});

describe('UsersService.updateMe', () => {
  function build(taken: unknown = null) {
    const tx = { user: { update: jest.fn() }, customer: { updateMany: jest.fn() } };
    const prisma = {
      client: {
        user: { findFirst: jest.fn().mockResolvedValue(taken) },
        $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<void>) => fn(tx)),
      },
    };
    return { svc: new UsersService({} as never, prisma as never), tx };
  }
  it('keeps Customer.fullName in sync', async () => {
    const { svc, tx } = build();
    await svc.updateMe('u1', 't1', { fullName: 'Asha Rao', email: 'A@X.com' });
    expect(tx.user.update.mock.calls[0][0].data).toMatchObject({ firstName: 'Asha', lastName: 'Rao', email: 'a@x.com' });
    expect(tx.customer.updateMany).toHaveBeenCalledWith({ where: { userId: 'u1', tenantId: 't1' }, data: { fullName: 'Asha Rao', email: 'a@x.com' } });
  });
  it('rejects an email used by someone else', async () => {
    const { svc } = build({ id: 'u2' });
    await expect(svc.updateMe('u1', 't1', { email: 'a@x.com' })).rejects.toBeInstanceOf(ConflictException);
  });
  it('only touches the avatar when only the avatar changes', async () => {
    const { svc, tx } = build();
    await svc.updateMe('u1', 't1', { avatarUrl: null });
    expect(tx.user.update.mock.calls[0][0].data).toMatchObject({ avatarUrl: null });
    expect(tx.customer.updateMany).not.toHaveBeenCalled();
  });
});
