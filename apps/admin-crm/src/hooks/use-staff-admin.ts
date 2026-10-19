'use client';

import type { RoleKey } from '@ac/types';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  type CreateRoleInput,
  type CreateStaffUserInput,
  rolesApi,
  type StaffUserListQuery,
  staffUsersApi,
  type UpdateStaffUserInput,
} from '@/lib/api/staff-admin';

/** Query keys for staff users & roles (kept local to avoid churn in the shared factory). */
export const staffAdminKeys = {
  users: ['admin-users'] as const,
  userList: (params: Record<string, unknown>) => ['admin-users', 'list', params] as const,
  assignableRoles: ['admin-users', 'assignable-roles'] as const,
  roles: ['admin-roles'] as const,
  permissions: ['admin-roles', 'permissions'] as const,
};

export function useStaffUsers(query: StaffUserListQuery) {
  return useQuery({
    queryKey: staffAdminKeys.userList(query as Record<string, unknown>),
    queryFn: () => staffUsersApi.list(query),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useAssignableRoles() {
  return useQuery({
    queryKey: staffAdminKeys.assignableRoles,
    queryFn: () => staffUsersApi.assignableRoles(),
    staleTime: 60_000,
  });
}

export function useRoles(enabled = true) {
  return useQuery({
    queryKey: staffAdminKeys.roles,
    queryFn: () => rolesApi.list(),
    enabled,
    retry: false,
  });
}

export function usePermissionCatalog(enabled = true) {
  return useQuery({
    queryKey: staffAdminKeys.permissions,
    queryFn: () => rolesApi.permissions(),
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

function useInvalidateUsers() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: staffAdminKeys.users });
}

export function useCreateStaffUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (input: CreateStaffUserInput) => staffUsersApi.create(input),
    onSuccess: invalidate,
  });
}

export function useUpdateStaffUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateStaffUserInput }) => staffUsersApi.update(id, input),
    onSuccess: invalidate,
  });
}

export function useSetStaffUserRoles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, roleKeys }: { id: string; roleKeys: RoleKey[] }) => staffUsersApi.setRoles(id, roleKeys),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: staffAdminKeys.users });
      void qc.invalidateQueries({ queryKey: staffAdminKeys.roles });
    },
  });
}

export function useDeactivateStaffUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => staffUsersApi.deactivate(id, reason),
    onSuccess: invalidate,
  });
}

export function useReactivateStaffUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (id: string) => staffUsersApi.reactivate(id),
    onSuccess: invalidate,
  });
}

export function useRevokeStaffSessions() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (id: string) => staffUsersApi.revokeSessions(id),
    onSuccess: invalidate,
  });
}

export function useSetRolePermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, permissionKeys }: { id: string; permissionKeys: string[] }) =>
      rolesApi.setPermissions(id, permissionKeys),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: staffAdminKeys.roles });
      void qc.invalidateQueries({ queryKey: staffAdminKeys.assignableRoles });
    },
  });
}

export function useResetRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => rolesApi.reset(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: staffAdminKeys.roles });
      void qc.invalidateQueries({ queryKey: staffAdminKeys.assignableRoles });
    },
  });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRoleInput) => rolesApi.create(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: staffAdminKeys.roles });
      void qc.invalidateQueries({ queryKey: staffAdminKeys.assignableRoles });
    },
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; name?: string; description?: string }) =>
      rolesApi.update(id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: staffAdminKeys.roles });
      void qc.invalidateQueries({ queryKey: staffAdminKeys.assignableRoles });
      // Staff rows show role names.
      void qc.invalidateQueries({ queryKey: staffAdminKeys.users });
    },
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => rolesApi.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: staffAdminKeys.roles });
      void qc.invalidateQueries({ queryKey: staffAdminKeys.assignableRoles });
    },
  });
}
