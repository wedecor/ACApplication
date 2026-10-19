import '@testing-library/jest-dom/vitest';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RoleView } from '@/lib/api/staff-admin';

import { CreateRoleModal } from '../create-role-modal';

const mutateAsync = vi.fn();
vi.mock('@/hooks/use-staff-admin', () => ({
  useCreateRole: () => ({ mutateAsync, isPending: false }),
}));
// The real modules pull in the API client, which needs client env vars.
vi.mock('@/lib/api/error-message', () => ({ apiErrorMessage: (_: unknown, fallback: string) => fallback }));
vi.mock('@/lib/rbac/permissions', () => ({
  readSessionClaims: () => ({ roles: ['ADMIN'], permissions: ['booking:read', 'lead:view'], permissionVersion: 1 }),
  hasPermission: (required: string, granted: string[]) => granted.includes('*') || granted.includes(required),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function role(overrides: Partial<RoleView>): RoleView {
  return {
    id: 'r1',
    key: 'DISPATCHER',
    name: 'Dispatcher',
    description: null,
    isSystem: true,
    isCustom: false,
    isCustomised: false,
    isImmutable: false,
    matchesDefaults: true,
    permissionKeys: [],
    userCount: 0,
    ...overrides,
  } as RoleView;
}

const ROLES = [
  role({ id: 'r_disp', permissionKeys: ['booking:read', 'lead:view', 'payment:refund'] }),
  role({ id: 'r_super', key: 'SUPER_ADMIN', name: 'Super Admin', isImmutable: true, permissionKeys: ['*'] }),
];

function renderModal(onCreated = vi.fn()) {
  render(<CreateRoleModal open onOpenChange={vi.fn()} roles={ROLES} onCreated={onCreated} />);
  return { onCreated };
}

describe('CreateRoleModal', () => {
  beforeEach(() => {
    mutateAsync.mockReset();
    mutateAsync.mockResolvedValue(role({ id: 'r_new', key: 'CUSTOM_AREA_LEAD', name: 'Area lead', isCustom: true }));
  });

  it('copies only the template permissions the admin holds', async () => {
    const { onCreated } = renderModal();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  Area lead ' } });
    fireEvent.change(screen.getByLabelText('Start with permissions from'), { target: { value: 'r_disp' } });

    expect(screen.getByText(/1 permission on Dispatcher won’t be copied/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Create role' }));
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        name: 'Area lead',
        description: undefined,
        permissionKeys: ['booking:read', 'lead:view'],
      }),
    );
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 'r_new' }));
  });

  it('does not offer Super Admin as a template', () => {
    renderModal();
    expect(screen.queryByRole('option', { name: /Super Admin/ })).not.toBeInTheDocument();
  });

  it('keeps Create disabled until the name has two characters', () => {
    renderModal();
    const create = screen.getByRole('button', { name: 'Create role' });
    expect(create).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: ' a ' } });
    expect(create).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ops' } });
    expect(create).toBeEnabled();
  });
});
