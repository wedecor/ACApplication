export * from './registry';
export * from './validate';
export type { RbacConsistencyReport, RbacHealthReport, RbacSyncStats } from './types';

import { Permission, UserRole } from '@ac/types';

/**
 * Default role -> permission map. Mirrors the DB seed in `@ac/database`.
 * The single source of truth at runtime is the database; this is a typed
 * fallback for offline tooling and tests.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.SUPER_ADMIN]: [Permission.ALL],
  [UserRole.ADMIN]: [
    Permission.BOOKING_READ,
    Permission.BOOKING_WRITE,
    Permission.BOOKING_ASSIGN,
    Permission.BOOKING_CANCEL,
    Permission.CUSTOMER_READ,
    Permission.CUSTOMER_WRITE,
    Permission.TECHNICIAN_READ,
    Permission.TECHNICIAN_WRITE,
    Permission.TECHNICIAN_ONBOARD,
    Permission.INVOICE_READ,
    Permission.INVOICE_WRITE,
    Permission.PAYMENT_READ,
    Permission.PAYMENT_REFUND,
    Permission.USER_MANAGE,
    Permission.ROLE_MANAGE,
    Permission.ANALYTICS_VIEW,
    Permission.AUDIT_LOG_VIEW,
    Permission.NOTIFICATION_VIEW,
    Permission.NOTIFICATION_RETRY,
    Permission.CITY_MANAGE,
    Permission.SUPPORT_VIEW,
    Permission.TICKET_VIEW,
    Permission.TICKET_CREATE,
    Permission.TICKET_UPDATE,
    Permission.TICKET_ASSIGN,
    Permission.TICKET_ESCALATE,
    Permission.TICKET_CLOSE,
    Permission.TICKET_REOPEN,
    Permission.TICKET_DELETE,
    Permission.TICKET_MERGE,
    Permission.INBOX_VIEW,
    Permission.INBOX_MANAGE,
    Permission.CONVERSATION_VIEW,
    Permission.CONVERSATION_REPLY,
    Permission.CONVERSATION_ASSIGN,
    Permission.CALL_VIEW,
    Permission.CALL_MANAGE,
    Permission.CALL_MAKE,
    Permission.CALL_DISPOSITION,
    Permission.KB_VIEW,
    Permission.KB_WRITE,
    Permission.KB_PUBLISH,
    Permission.CANNED_RESPONSE_VIEW,
    Permission.CANNED_RESPONSE_MANAGE,
    Permission.SLA_VIEW,
    Permission.SLA_MANAGE,
    Permission.SUPPORT_ANALYTICS_VIEW,
  ],
  [UserRole.DISPATCHER]: [
    Permission.BOOKING_READ,
    Permission.BOOKING_WRITE,
    Permission.BOOKING_ASSIGN,
    Permission.BOOKING_CANCEL,
    Permission.CUSTOMER_READ,
    Permission.TECHNICIAN_READ,
    Permission.ANALYTICS_VIEW,
  ],
  [UserRole.CALL_CENTER_AGENT]: [
    Permission.BOOKING_READ,
    Permission.BOOKING_WRITE,
    Permission.CUSTOMER_READ,
    Permission.CUSTOMER_WRITE,
    Permission.TECHNICIAN_READ,
    Permission.SUPPORT_VIEW,
    Permission.TICKET_VIEW,
    Permission.TICKET_CREATE,
    Permission.TICKET_UPDATE,
    Permission.TICKET_ASSIGN,
    Permission.TICKET_ESCALATE,
    Permission.TICKET_CLOSE,
    Permission.INBOX_VIEW,
    Permission.CONVERSATION_VIEW,
    Permission.CONVERSATION_REPLY,
    Permission.CONVERSATION_ASSIGN,
    Permission.CALL_VIEW,
    Permission.CALL_MAKE,
    Permission.CALL_DISPOSITION,
    Permission.KB_VIEW,
    Permission.CANNED_RESPONSE_VIEW,
  ],
  [UserRole.TECHNICIAN]: [
    Permission.BOOKING_READ,
    Permission.TICKET_VIEW,
    Permission.CONVERSATION_VIEW,
    Permission.KB_VIEW,
  ],
  [UserRole.CUSTOMER]: [Permission.TICKET_VIEW, Permission.TICKET_CREATE, Permission.KB_VIEW],
};

/**
 * Returns true if the given roles or explicit permission set grants the
 * specified permission. Honors the `*` wildcard.
 */
/**
 * Runtime authorization uses DB-loaded permissions on the principal only.
 * `DEFAULT_ROLE_PERMISSIONS` is for offline tooling/tests — not unioned here.
 */
export function hasPermission(
  required: Permission,
  granted: { roles?: UserRole[]; permissions?: Permission[] },
): boolean {
  void granted.roles;
  const permSet = new Set<string>(granted.permissions ?? []);
  if (permSet.has(Permission.ALL)) return true;
  return permSet.has(required);
}

/**
 * Bulk check — useful for guarding a route that needs ALL of several perms.
 */
export function hasAllPermissions(
  required: Permission[],
  granted: { roles?: UserRole[]; permissions?: Permission[] },
): boolean {
  return required.every((p) => hasPermission(p, granted));
}

/**
 * ANY-of check — for routes that accept multiple permissions.
 */
export function hasAnyPermission(
  required: Permission[],
  granted: { roles?: UserRole[]; permissions?: Permission[] },
): boolean {
  return required.some((p) => hasPermission(p, granted));
}

/**
 * Role hierarchy check. SUPER_ADMIN > ADMIN > DISPATCHER > CALL_CENTER_AGENT
 * > TECHNICIAN > CUSTOMER. Returns true when `granted` outranks `required`.
 */
const ROLE_RANK: Record<UserRole, number> = {
  [UserRole.SUPER_ADMIN]: 100,
  [UserRole.ADMIN]: 90,
  [UserRole.DISPATCHER]: 70,
  [UserRole.CALL_CENTER_AGENT]: 60,
  [UserRole.TECHNICIAN]: 40,
  [UserRole.CUSTOMER]: 10,
};

export function outranks(granted: UserRole[], required: UserRole): boolean {
  const max = Math.max(...granted.map((r) => ROLE_RANK[r] ?? 0));
  return max >= (ROLE_RANK[required] ?? 0);
}

export const RBAC = {
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  outranks,
  DEFAULT_ROLE_PERMISSIONS,
};
