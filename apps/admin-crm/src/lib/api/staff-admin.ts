import type { UserRole } from '@ac/types';

import { apiFetch, type PaginatedResponse } from './client';

export type StaffUserStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING' | 'DELETED';

export interface StaffUserRole {
  id: string;
  key: UserRole;
  name: string;
  assignedAt: string;
  assignedBy: string | null;
}

export interface StaffUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  status: StaffUserStatus;
  authProvider: string;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  technicianId: string | null;
  roles: StaffUserRole[];
  activeSessions: number;
}

export interface StaffUserListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  roleKey?: UserRole;
  status?: Exclude<StaffUserStatus, 'DELETED'>;
  includeTechnicians?: boolean;
}

export interface AssignableRole {
  id: string;
  key: UserRole;
  name: string;
  description: string | null;
  grantable: boolean;
}

export interface CreateStaffUserInput {
  firstName: string;
  lastName?: string;
  phone?: string;
  email?: string;
  roleKeys: UserRole[];
}

export type UpdateStaffUserInput = Partial<Omit<CreateStaffUserInput, 'roleKeys'>>;

export interface RoleView {
  id: string;
  key: UserRole;
  name: string;
  description: string | null;
  isSystem: boolean;
  isCustomised: boolean;
  isImmutable: boolean;
  matchesDefaults: boolean;
  permissionKeys: string[];
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PermissionDefinition {
  id: string;
  key: string;
  resource: string;
  action: string;
  description: string | null;
}

export interface PermissionCatalog {
  total: number;
  groups: { resource: string; permissions: PermissionDefinition[] }[];
}

export const staffUsersApi = {
  list: (query: StaffUserListQuery = {}) =>
    apiFetch<PaginatedResponse<StaffUser>>('/admin/users', { query: query as Record<string, unknown> }),
  get: (id: string) => apiFetch<StaffUser>(`/admin/users/${id}`),
  assignableRoles: () => apiFetch<AssignableRole[]>('/admin/users/assignable-roles'),
  create: (input: CreateStaffUserInput) =>
    apiFetch<StaffUser>('/admin/users', { method: 'POST', body: input }),
  update: (id: string, input: UpdateStaffUserInput) =>
    apiFetch<StaffUser>(`/admin/users/${id}`, { method: 'PATCH', body: input }),
  setRoles: (id: string, roleKeys: UserRole[]) =>
    apiFetch<StaffUser>(`/admin/users/${id}/roles`, { method: 'PUT', body: { roleKeys } }),
  deactivate: (id: string, reason?: string) =>
    apiFetch<{ id: string; sessionsRevoked: number }>(`/admin/users/${id}/deactivate`, {
      method: 'POST',
      body: { reason },
    }),
  reactivate: (id: string) =>
    apiFetch<StaffUser>(`/admin/users/${id}/reactivate`, { method: 'POST', body: {} }),
  revokeSessions: (id: string) =>
    apiFetch<{ id: string; sessionsRevoked: number }>(`/admin/users/${id}/revoke-sessions`, {
      method: 'POST',
      body: {},
    }),
};

export const rolesApi = {
  list: () => apiFetch<RoleView[]>('/admin/roles'),
  permissions: () => apiFetch<PermissionCatalog>('/admin/roles/permissions'),
  setPermissions: (id: string, permissionKeys: string[]) =>
    apiFetch<RoleView>(`/admin/roles/${id}/permissions`, { method: 'PUT', body: { permissionKeys } }),
  reset: (id: string) => apiFetch<RoleView>(`/admin/roles/${id}/reset`, { method: 'POST', body: {} }),
  update: (id: string, input: { name?: string; description?: string }) =>
    apiFetch<RoleView>(`/admin/roles/${id}`, { method: 'PATCH', body: input }),
};
