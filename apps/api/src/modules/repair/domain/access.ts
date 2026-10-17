import type { AuthPrincipal } from '@ac/auth';

const STAFF_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'DISPATCHER', 'CALL_CENTER_AGENT']);

/**
 * A "field technician" is a principal holding the TECHNICIAN role and no
 * back-office role. Field technicians are scoped to bookings assigned to
 * them; staff can see (and, with the right permission, edit) everything.
 */
export function isFieldTechnician(actor: Pick<AuthPrincipal, 'roles'>): boolean {
  const roles = (actor.roles ?? []) as string[];
  return roles.includes('TECHNICIAN') && !roles.some((r) => STAFF_ROLES.has(r));
}
