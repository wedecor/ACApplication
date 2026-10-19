import { ROLE_PERMISSIONS } from '@ac/auth';
import { UserRole } from '@ac/types';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { RolesService } from '../roles.service';

function roleRow(id: string, key: string, keys: string[], isSystem = true, isCustom = false) {
  return {
    id,
    key,
    name: key,
    description: null,
    isSystem,
    isCustom,
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
    role: { update: jest.fn(), delete: jest.fn().mockResolvedValue({ id: 'r_new' }) },
    userRoleAssignment: { count: jest.fn().mockResolvedValue(0) },
    tenant: { update: jest.fn().mockResolvedValue({ rbacVersion: 2 }) },
  };
  const client = {
    $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    role: {
      findFirst: jest.fn().mockResolvedValue(role),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'r_new' }),
    },
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
    expect(tx.role.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isSystem: false, updatedBy: 'admin_1' } }),
    );
    expect(tx.tenant.update).toHaveBeenCalledTimes(1);
    expect(res.isCustomised).toBe(true);
  });

  it('reset restores registry defaults and marks the role registry-managed', async () => {
    const defaults = ROLE_PERMISSIONS.CALL_CENTER_AGENT;
    const current = roleRow('r_cc', 'CALL_CENTER_AGENT', defaults.slice(1), false);
    const { service, tx } = build(current);
    await service.resetToDefaults(principal({ permissions: ['*'], roles: ['SUPER_ADMIN'] }) as never, 'r_cc');
    expect(tx.role.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isSystem: true, updatedBy: 'admin_1' } }),
    );
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

  describe('custom roles', () => {
    const custom = () => roleRow('r_new', 'CUSTOM_REGIONAL_MANAGER', ['lead:view'], false, true);

    it('creates a CUSTOM_ role with the requested permissions and audit fields', async () => {
      const { service, client } = build(custom());
      client.role.findMany.mockResolvedValue([{ key: 'ADMIN', name: 'Admin', isCustom: false }]);

      const res = await service.create(principal() as never, {
        name: ' Regional manager ',
        permissionKeys: ['lead:view'],
      });

      expect(client.role.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            key: 'CUSTOM_REGIONAL_MANAGER',
            name: 'Regional manager',
            isSystem: false,
            isCustom: true,
            createdBy: 'admin_1',
            updatedBy: 'admin_1',
            permissions: { create: [{ permissionId: 'p_lead:view' }] },
          }),
        }),
      );
      expect(res.isCustom).toBe(true);
      expect(res.isCustomised).toBe(false);
      expect(res.matchesDefaults).toBe(true);
    });

    it('suffixes the key when the name collides with an existing key', async () => {
      const { service, client } = build(custom());
      client.role.findMany.mockResolvedValue([
        { key: 'CUSTOM_AUDITOR', name: 'Old auditor', isCustom: true },
      ]);
      await service.create(principal() as never, { name: 'Auditor', permissionKeys: [] });
      expect(client.role.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ key: 'CUSTOM_AUDITOR_2' }) }),
      );
    });

    it('rejects a duplicate role name, case-insensitively', async () => {
      const { service, client } = build(custom());
      client.role.findMany.mockResolvedValue([{ key: 'DISPATCHER', name: 'Dispatcher', isCustom: false }]);
      await expect(
        service.create(principal() as never, { name: 'dispatcher', permissionKeys: [] }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(client.role.create).not.toHaveBeenCalled();
    });

    it('cannot create a role with permissions the actor does not hold', async () => {
      const { service, client } = build(custom());
      await expect(
        service.create(principal() as never, { name: 'Finance', permissionKeys: ['payout:approve'] }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(client.role.create).not.toHaveBeenCalled();
    });

    it('cannot create a role with the wildcard, even as super admin', async () => {
      const { service } = build(custom());
      await expect(
        service.create(principal({ roles: ['SUPER_ADMIN'], permissions: ['*'] }) as never, {
          name: 'Everything',
          permissionKeys: ['*'],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('stays custom (never registry-managed) when its permissions change', async () => {
      const { service, tx } = build(custom());
      await service.setPermissions(principal() as never, 'r_new', ['lead:create']);
      expect(tx.role.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isSystem: false, updatedBy: 'admin_1' } }),
      );
    });

    it('has no defaults to reset to', async () => {
      const { service } = build(custom());
      await expect(service.resetToDefaults(principal() as never, 'r_new')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('deletes an unassigned custom role', async () => {
      const { service, tx } = build(custom());
      await expect(service.remove(principal() as never, 'r_new')).resolves.toEqual({
        id: 'r_new',
        deleted: true,
      });
      expect(tx.role.delete).toHaveBeenCalledWith({ where: { id: 'r_new' }, select: { id: true } });
    });

    it('reports 404 when another admin deleted the role first', async () => {
      const { service, tx } = build(custom());
      tx.role.delete.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Record to delete does not exist.', {
          code: 'P2025',
          clientVersion: 'test',
        }),
      );
      await expect(service.remove(principal() as never, 'r_new')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuses to delete a custom role that users still hold', async () => {
      const { service, tx } = build(custom());
      tx.userRoleAssignment.count.mockResolvedValue(3);
      await expect(service.remove(principal() as never, 'r_new')).rejects.toBeInstanceOf(ConflictException);
      expect(tx.role.delete).not.toHaveBeenCalled();
    });

    it('refuses to delete a system role', async () => {
      const { service, tx } = build(roleRow('r_disp', 'DISPATCHER', ['lead:view']));
      await expect(service.remove(principal() as never, 'r_disp')).rejects.toBeInstanceOf(ForbiddenException);
      expect(tx.role.delete).not.toHaveBeenCalled();
    });
  });
});
