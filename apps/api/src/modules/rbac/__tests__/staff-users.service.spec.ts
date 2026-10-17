import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { UserRole, UserStatus } from '@ac/types';

import { StaffUsersService } from '../staff-users.service';

const ROLES = [
  { id: 'r_admin', key: 'ADMIN', name: 'Admin', description: null, isSystem: true, perms: ['user:manage', 'role:manage', 'lead:view'] },
  { id: 'r_disp', key: 'DISPATCHER', name: 'Dispatcher', description: null, isSystem: true, perms: ['lead:view'] },
  { id: 'r_super', key: 'SUPER_ADMIN', name: 'Super Admin', description: null, isSystem: true, perms: ['*'] },
  { id: 'r_tech', key: 'TECHNICIAN', name: 'Technician', description: null, isSystem: true, perms: ['technician:status:write'] },
].map((r) => ({ ...r, permissions: r.perms.map((key) => ({ permission: { key } })) }));

function principal(overrides: Partial<{ userId: string; roles: string[]; permissions: string[] }> = {}) {
  return {
    userId: 'admin_1',
    tenantId: 'tenant_1',
    sessionId: 's',
    roles: [UserRole.ADMIN],
    permissions: ['user:manage', 'role:manage', 'lead:view'],
    email: null,
    phone: null,
    permissionVersion: 1,
    iat: 0,
    exp: 0,
    ...overrides,
  };
}

function userRow(id: string, roleIds: string[], status: string = UserStatus.ACTIVE) {
  return {
    id,
    firstName: 'A',
    lastName: null,
    email: null,
    phone: '+910000000000',
    avatarUrl: null,
    status,
    authProvider: 'OTP',
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    updatedBy: null,
    technician: null,
    roles: roleIds.map((rid) => {
      const r = ROLES.find((x) => x.id === rid)!;
      return { assignedAt: new Date(), assignedBy: null, role: { id: r.id, key: r.key, name: r.name } };
    }),
  };
}

function build() {
  const tx = {
    user: { create: jest.fn().mockResolvedValue({ id: 'new_user' }), update: jest.fn() },
    userRoleAssignment: { createMany: jest.fn(), deleteMany: jest.fn() },
    session: { updateMany: jest.fn().mockResolvedValue({ count: 3 }) },
    tenant: { update: jest.fn().mockResolvedValue({ rbacVersion: 7 }) },
  };
  const client = {
    $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    role: { findMany: jest.fn().mockResolvedValue(ROLES) },
    user: { findFirst: jest.fn(), findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn(), count: jest.fn() },
    session: { count: jest.fn().mockResolvedValue(0) },
  };
  const service = new StaffUsersService({ client } as never);
  return { service, client, tx };
}

describe('StaffUsersService', () => {
  it('creates a staff user with roles in one transaction', async () => {
    const { service, client, tx } = build();
    client.user.findFirst.mockResolvedValue(userRow('new_user', ['r_disp']));
    const res = await service.create(principal() as never, {
      firstName: 'Neha',
      phone: '+919811111111',
      roleKeys: [UserRole.DISPATCHER],
    });
    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: UserStatus.ACTIVE, createdBy: 'admin_1', authProvider: 'OTP' }),
      }),
    );
    expect(tx.userRoleAssignment.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'new_user', roleId: 'r_disp', assignedBy: 'admin_1' }],
    });
    expect(res.roles.map((r) => r.key)).toEqual(['DISPATCHER']);
  });

  it('requires a phone or email', async () => {
    const { service } = build();
    await expect(
      service.create(principal() as never, { firstName: 'X', roleKeys: [UserRole.DISPATCHER] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses to grant SUPER_ADMIN from a non-super-admin (escalation)', async () => {
    const { service } = build();
    await expect(
      service.create(principal() as never, { firstName: 'X', phone: '+919800000009', roleKeys: [UserRole.SUPER_ADMIN] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses TECHNICIAN role assignment (profile-managed)', async () => {
    const { service } = build();
    await expect(
      service.create(principal() as never, { firstName: 'X', phone: '+919800000009', roleKeys: [UserRole.TECHNICIAN] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('prevents an admin from dropping their own user/role management', async () => {
    const { service, client, tx } = build();
    client.user.findFirst.mockResolvedValue(userRow('admin_1', ['r_admin']));
    await expect(
      service.setRoles(principal() as never, 'admin_1', [UserRole.DISPATCHER]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.tenant.update).not.toHaveBeenCalled();
  });

  it('replaces roles, preserves TECHNICIAN and bumps the RBAC version', async () => {
    const { service, client, tx } = build();
    client.user.findFirst.mockResolvedValue(userRow('u2', ['r_disp', 'r_tech']));
    await service.setRoles(principal() as never, 'u2', [UserRole.ADMIN]);
    expect(tx.userRoleAssignment.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u2', roleId: { in: ['r_disp'] } },
    });
    expect(tx.userRoleAssignment.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: [{ userId: 'u2', roleId: 'r_admin', assignedBy: 'admin_1' }] }),
    );
    expect(tx.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'tenant_1' }, data: { rbacVersion: { increment: 1 } } }),
    );
  });

  it('does not let an admin modify a super admin', async () => {
    const { service, client } = build();
    client.user.findFirst.mockResolvedValue(userRow('root', ['r_super']));
    await expect(service.deactivate(principal() as never, 'root', {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks self-deactivation', async () => {
    const { service } = build();
    await expect(service.deactivate(principal() as never, 'admin_1', {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('deactivates and revokes sessions', async () => {
    const { service, client, tx } = build();
    client.user.findFirst.mockResolvedValue(userRow('u2', ['r_disp']));
    const res = await service.deactivate(principal() as never, 'u2', { reason: 'left company' });
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: UserStatus.SUSPENDED, updatedBy: 'admin_1' } }),
    );
    expect(res.sessionsRevoked).toBe(3);
  });

  it('refuses revoking the last staff role', async () => {
    const { service, client } = build();
    client.user.findFirst.mockResolvedValue(userRow('u2', ['r_disp']));
    await expect(service.revokeRole(principal() as never, 'u2', UserRole.DISPATCHER)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects assigning a role the user already has', async () => {
    const { service, client } = build();
    client.user.findFirst.mockResolvedValue(userRow('u2', ['r_disp']));
    await expect(service.assignRole(principal() as never, 'u2', UserRole.DISPATCHER)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('revokeSessions bumps the RBAC version only when something was revoked', async () => {
    const { service, client, tx } = build();
    client.user.findFirst.mockResolvedValue(userRow('u2', ['r_disp']));
    tx.session.updateMany.mockResolvedValueOnce({ count: 0 });
    await service.revokeSessions(principal() as never, 'u2');
    expect(tx.tenant.update).not.toHaveBeenCalled();
    await service.revokeSessions(principal() as never, 'u2');
    expect(tx.tenant.update).toHaveBeenCalledTimes(1);
  });
});
