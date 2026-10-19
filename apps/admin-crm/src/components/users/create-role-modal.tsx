'use client';

import type { Permission } from '@ac/types';
import {
  Button,
  Input,
  Label,
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from '@ac/ui';
import * as React from 'react';
import { toast } from 'sonner';

import { useCreateRole } from '@/hooks/use-staff-admin';
import { apiErrorMessage } from '@/lib/api/error-message';
import type { RoleView } from '@/lib/api/staff-admin';
import { hasPermission, readSessionClaims } from '@/lib/rbac/permissions';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing roles, offered as a permission template. */
  roles: readonly RoleView[];
  /** Called with the new role so the matrix can select it. */
  onCreated: (role: RoleView) => void;
}

const selectCls = 'h-9 w-full rounded-md border bg-background px-3 text-sm';

/**
 * Creates a custom role. Permissions can be copied from an existing role;
 * only the ones the current admin holds are copied, because the API refuses
 * to grant anything the actor doesn't hold. Fine-tuning happens in the matrix.
 */
export function CreateRoleModal({ open, onOpenChange, roles, onCreated }: Props) {
  const create = useCreateRole();
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [templateId, setTemplateId] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    setName('');
    setDescription('');
    setTemplateId('');
  }, [open]);

  const template = roles.find((r) => r.id === templateId);
  const { permissions: mine } = readSessionClaims();
  const copyable = template?.isImmutable
    ? []
    : (template?.permissionKeys ?? []).filter((k) => hasPermission(k as Permission, mine));
  const skipped = (template?.permissionKeys.length ?? 0) - copyable.length;
  const trimmed = name.trim();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (trimmed.length < 2) return;
    try {
      const role = await create.mutateAsync({
        name: trimmed,
        description: description.trim() || undefined,
        permissionKeys: copyable,
      });
      toast.success(`${role.name} created — choose its permissions, then assign it to users`);
      onCreated(role);
      onOpenChange(false);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to create role'));
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-md">
        <form onSubmit={(e) => void submit(e)} className="space-y-4">
          <ModalHeader>
            <ModalTitle>New role</ModalTitle>
            <ModalDescription>
              A custom role grants exactly the permissions you tick for it. You can only give it permissions you hold.
            </ModalDescription>
          </ModalHeader>

          <div className="space-y-1.5">
            <Label htmlFor="role-name">Name</Label>
            <Input
              id="role-name"
              required
              minLength={2}
              maxLength={60}
              placeholder="e.g. Regional manager"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="role-description">Description (optional)</Label>
            <Input
              id="role-description"
              maxLength={300}
              placeholder="What this role is for"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="role-template">Start with permissions from</Label>
            <select
              id="role-template"
              className={selectCls}
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              <option value="">No permissions</option>
              {roles
                .filter((r) => !r.isImmutable)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.permissionKeys.length})
                  </option>
                ))}
            </select>
            {skipped > 0 ? (
              <p className="text-xs text-muted-foreground">
                {skipped} permission{skipped === 1 ? '' : 's'} on {template?.name} won’t be copied because you don’t hold{' '}
                {skipped === 1 ? 'it' : 'them'}.
              </p>
            ) : null}
          </div>

          <ModalFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={trimmed.length < 2 || create.isPending}>
              {create.isPending ? 'Creating…' : 'Create role'}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
