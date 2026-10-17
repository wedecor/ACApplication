import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ROLE_PERMISSIONS } from '@ac/auth';
import { UserRole } from '@ac/types';

import { RolesService } from '../roles.service';

function roleRow(id: string, key: string, keys: string[], isSystem = true) {
  return {
    id,
    key,
    name: key,
    description: null,
    isSystem,
    createdAt: new Date(),
    updatedAt: new Date(),
    permissions: keys.map((k) => ({ permission: { id: `p_${k}`, key: k } })),
    _count: { users: 1 },
  };
}

function principal(overrides: Partial<{ roles: string[]; permissions: string[] }> = {}) {
  return {
    userId: 'admin_1',
    tenantId: 'tenant_1',
    sessionId: 's',
    roles: [UserRole.ADMIN],
    permissions: ['user:manage', 'role:manage', 'lead:view', 'lead:create'],
    email: null,
    phone: null,
    permissionVersion: 1,
    iat: 0,
    exp: 0,
    ...overrides,
  };
}

function build(role: ReturnType<typeof roleRow>) {
  const tx = {
    rolePermission: { deleteMany: jest.fn(), createMany: jest.fn() },
    role: { update: jest.fn() },
    tenant: { update: jest.fn().mockResolvedValue({ rbacVersion: 2 }) },
  };
  const client = {
    $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    role: { findFirst: jest.fn().mockResolvedValue(role), findMany: jest.fn() },
    permission: {
      findMany: jest.fn(async ({ where }: { where: { key: { in: string[] } } }) =>
        where.key.in.filter((k) => !k.startsWith('unknown')).map((k) => ({ id: `p_${k}`, key: k })),
      ),
    },
    userRoleAssignment: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const service = new RolesService({ client } as never);
  return { service, client, tx };
}

describe('RolesService', () => {
  it('SUPER_ADMIN is immutable', async () => {
    const { service } = build(roleRow('r_super', 'SUPER_ADMIN', ['*']));
    await expect(
      service.setPermissions(principal({ roles: ['SUPER_ADMIN'], permissions: ['*'] }) as never, 'r_super', []),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects unknown permission keys', async () => {
    const { service } = build(roleRow('r_disp', 'DISPATCHER', ['lead:view']));
    await expect(
      service.setPermissions(principal() as never, 'r_disp', ['lead:view', 'unknown:thing']),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects granting permissions the actor does not hold', async () => {
    const { service } = build(roleRow('r_disp', 'DISPATCHER', ['lead:view']));
    await expect(
      service.setPermissions(principal() as never, 'r_disp', ['lead:view', 'payout:approve']),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('prevents removing your own role:manage via a role you hold', async () => {
    const admin = roleRow('r_admin', 'ADMIN', ['user:manage', 'role:manage', 'lead:view']);
    const { service, client } = build(admin);
    client.userRoleAssignment.findMany.mockResolvedValue([
      { role: { key: 'ADMIN', permissions: admin.permissions } },
    ]);
    await expect(
      service.setPermissions(principal() as never, 'r_admin', ['user:manage', 'lead:view']),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('applies the diff, marks the role customised and bumps the RBAC version', async () => {
    const { service, client, tx } = build(roleRow('r_disp', 'DISPATCHER', ['lead:view']));
    client.role.findFirst
      .mockResolvedValueOnce(roleRow('r_disp', 'DISPATCHER', ['lead:view']))
      .mockResolvedValueOnce(roleRow('r_disp', 'DISPATCHER', ['lead:create'], false));

    const res = await service.setPermissions(principal() as never, 'r_disp', ['lead:create']);

    expect(tx.rolePermission.deleteMany).toHaveBeenCalledWith({
      where: { roleId: 'r_disp', permissionId: { in: ['p_lead:view'] } },
    });
    expect(tx.rolePermission.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: [{ roleId: 'r_disp', permissionId: 'p_lead:create' }] }),
    );
    expect(tx.role.update).toHaveBeenCalledWith(expect.objectContaining({ data: { isSystem: false } }));
    expect(tx.tenant.update).toHaveBeenCalledTimes(1);
    expect(res.isCustomised).toBe(true);
  });

  it('reset restores registry defaults and marks the role registry-managed', async () => {
    const defaults = ROLE_PERMISSIONS.CALL_CENTER_AGENT;
    const current = roleRow('r_cc', 'CALL_CENTER_AGENT', defaults.slice(1), false);
    const { service, tx } = build(current);
    await service.resetToDefaults(principal({ permissions: ['*'], roles: ['SUPER_ADMIN'] }) as never, 'r_cc');
    expect(tx.role.update).toHaveBeenCalledWith(expect.objectContaining({ data: { isSystem: true } }));
    expect(tx.rolePermission.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: [{ roleId: 'r_cc', permissionId: `p_${defaults[0]}` }] }),
    );
    expect(tx.tenant.update).toHaveBeenCalledTimes(1);
  });

  it('never allows the wildcard on non-super-admin roles', async () => {
    const { service } = build(roleRow('r_disp', 'DISPATCHER', ['lead:view']));
    await expect(
      service.setPermissions(principal({ permissions: ['*'] }) as never, 'r_disp', ['*']),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
