import { Permission, UserRole } from '@ac/types';
import { DEFAULT_ROLE_PERMISSIONS, hasPermission } from '@ac/auth';

describe('@ac/auth hasPermission (DB-only)', () => {
  it('does not union DEFAULT_ROLE_PERMISSIONS for roles', () => {
    expect(
      hasPermission(Permission.DISPATCH_VIEW, {
        roles: [UserRole.DISPATCHER],
        permissions: [],
      }),
    ).toBe(false);
  });

  it('grants explicit DB permissions', () => {
    expect(hasPermission(Permission.LEAD_VIEW, { permissions: [Permission.LEAD_VIEW] })).toBe(
      true,
    );
  });

  it('documents fallback drift for call-center assign', () => {
    expect(DEFAULT_ROLE_PERMISSIONS[UserRole.CALL_CENTER_AGENT]).toContain(Permission.TICKET_ASSIGN);
    expect(
      hasPermission(Permission.TICKET_ASSIGN, {
        roles: [UserRole.CALL_CENTER_AGENT],
        permissions: [],
      }),
    ).toBe(false);
  });
});
