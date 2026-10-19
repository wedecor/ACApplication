import {
  customRoleKey,
  effectivePermissions,
  groupPermissionsByResource,
  holds,
  lostSelfProtectedPermissions,
  permissionsAfterRoleEdit,
  ROLE_KEY_PATTERN,
  samePermissionSet,
  ungrantablePermissions,
} from '../rbac-policy';

describe('rbac-policy', () => {
  it('holds() honours the wildcard', () => {
    expect(holds(new Set(['*']), 'lead:view')).toBe(true);
    expect(holds(['lead:view'], 'lead:view')).toBe(true);
    expect(holds(['lead:view'], 'lead:delete')).toBe(false);
  });

  it('ungrantablePermissions() blocks keys the actor lacks and the wildcard itself', () => {
    expect(ungrantablePermissions(['lead:view'], ['lead:view', 'lead:delete', '*'])).toEqual([
      'lead:delete',
      '*',
    ]);
    expect(ungrantablePermissions(['*'], ['anything:goes'])).toEqual([]);
  });

  it('detects self lock-out of user/role management', () => {
    const before = new Set(['user:manage', 'role:manage', 'lead:view']);
    expect(lostSelfProtectedPermissions(before, new Set(['user:manage']))).toEqual(['role:manage']);
    expect(lostSelfProtectedPermissions(before, new Set(['*']))).toEqual([]);
    expect(lostSelfProtectedPermissions(new Set(['lead:view']), new Set())).toEqual([]);
  });

  it('permissionsAfterRoleEdit() keeps grants that come from other roles', () => {
    const roles = [
      { key: 'ADMIN', permissions: ['user:manage', 'role:manage'] },
      { key: 'DISPATCHER', permissions: ['role:manage'] },
    ];
    const after = permissionsAfterRoleEdit(roles, 'ADMIN', []);
    expect([...after]).toEqual(['role:manage']);
    expect(effectivePermissions(roles).size).toBe(2);
  });

  it('groups permission definitions by resource and drops the wildcard', () => {
    const groups = groupPermissionsByResource([
      { key: 'lead:view', resource: 'lead', action: 'view', description: null },
      { key: '*', resource: '*', action: '*', description: null },
      { key: 'booking:read', resource: 'booking', action: 'read', description: null },
      { key: 'lead:create', resource: 'lead', action: 'create', description: null },
    ]);
    expect(groups.map((g) => g.resource)).toEqual(['booking', 'lead']);
    expect(groups[1]!.permissions.map((p) => p.key)).toEqual(['lead:create', 'lead:view']);
  });

  it('samePermissionSet ignores order and duplicates', () => {
    expect(samePermissionSet(['a:b', 'c:d', 'a:b'], ['c:d', 'a:b'])).toBe(true);
    expect(samePermissionSet(['a:b'], ['a:b', 'c:d'])).toBe(false);
  });

  it('customRoleKey() derives CUSTOM_<NAME> and avoids taken keys', () => {
    expect(customRoleKey('Regional manager', new Set())).toBe('CUSTOM_REGIONAL_MANAGER');
    expect(customRoleKey('  Café / QA lead! ', new Set())).toBe('CUSTOM_CAFE_QA_LEAD');
    expect(customRoleKey('Auditor', new Set(['CUSTOM_AUDITOR', 'CUSTOM_AUDITOR_2']))).toBe('CUSTOM_AUDITOR_3');
    expect(customRoleKey('मैनेजर', new Set())).toBe('CUSTOM_ROLE');
    expect(customRoleKey('x'.repeat(100), new Set())).toHaveLength('CUSTOM_'.length + 40);
  });

  it('every generated custom key is a valid role key', () => {
    for (const name of ['Regional manager', 'मैनेजर', 'a', '9 lives', 'x'.repeat(100)]) {
      expect(customRoleKey(name, new Set())).toMatch(ROLE_KEY_PATTERN);
    }
  });
});
