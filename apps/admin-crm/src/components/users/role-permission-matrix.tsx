'use client';

import type { Permission } from '@ac/types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  Skeleton,
} from '@ac/ui';
import { Lock, Pencil, Plus, RotateCcw, Shield, Trash2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { LoadError } from '@/components/common/load-error';
import {
  useDeleteRole,
  usePermissionCatalog,
  useResetRole,
  useRoles,
  useSetRolePermissions,
  useUpdateRole,
} from '@/hooks/use-staff-admin';
import { apiErrorMessage } from '@/lib/api/error-message';
import type { RoleView } from '@/lib/api/staff-admin';
import { humanizeEnum } from '@/lib/labels';
import { hasPermission, readSessionClaims } from '@/lib/rbac/permissions';

import { CreateRoleModal } from './create-role-modal';

/**
 * Role ↔ permission matrix. Pick a role, tick permissions grouped by
 * resource, save. Permissions the current admin doesn't hold are disabled
 * (the API enforces the same anti-escalation rule). Custom roles are created
 * here and can be deleted once no user holds them.
 */
export function RolePermissionMatrix() {
  const roles = useRoles();
  const catalog = usePermissionCatalog();
  const save = useSetRolePermissions();
  const reset = useResetRole();
  const { permissions: mine } = readSessionClaims();

  const [roleId, setRoleId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<Set<string>>(new Set());
  const [filter, setFilter] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  const [deleting, setDeleting] = React.useState<RoleView | null>(null);
  const [editing, setEditing] = React.useState<RoleView | null>(null);

  const role: RoleView | undefined = roles.data?.find((r) => r.id === roleId) ?? roles.data?.[0];

  React.useEffect(() => {
    if (role) setDraft(new Set(role.permissionKeys));
  }, [role?.id, role?.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  if (roles.error || catalog.error) {
    return <LoadError label="roles" message={apiErrorMessage(roles.error ?? catalog.error)} />;
  }
  if (roles.isLoading || catalog.isLoading || !role || !catalog.data) {
    return <Skeleton className="h-96 w-full" />;
  }

  const readOnly = role.isImmutable;
  const dirty =
    draft.size !== role.permissionKeys.length || role.permissionKeys.some((k) => !draft.has(k));
  const canToggle = (key: string) => !readOnly && hasPermission(key as Permission, mine);

  const toggle = (key: string) => {
    if (!canToggle(key)) return;
    setDraft((d) => {
      const next = new Set(d);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleGroup = (keys: string[], on: boolean) => {
    setDraft((d) => {
      const next = new Set(d);
      for (const k of keys) {
        if (!canToggle(k)) continue;
        if (on) next.add(k);
        else next.delete(k);
      }
      return next;
    });
  };

  const onSave = async () => {
    try {
      await save.mutateAsync({ id: role.id, permissionKeys: [...draft] });
      toast.success(`${role.name} permissions saved — signed-in users refresh their access automatically`);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to save permissions'));
    }
  };

  const onReset = async () => {
    try {
      await reset.mutateAsync(role.id);
      toast.success(`${role.name} restored to default permissions`);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to reset role'));
    }
  };

  const q = filter.trim().toLowerCase();
  const groups = catalog.data.groups
    .map((g) => ({
      ...g,
      permissions: g.permissions.filter(
        (p) => !q || p.key.includes(q) || (p.description ?? '').toLowerCase().includes(q),
      ),
    }))
    .filter((g) => g.permissions.length > 0);

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
      <nav aria-label="Roles" className="space-y-1">
        <Button variant="outline" size="sm" className="mb-2 w-full" onClick={() => setCreating(true)}>
          <Plus className="mr-1 size-3.5" /> New role
        </Button>
        {roles.data?.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRoleId(r.id)}
            aria-current={r.id === role.id ? 'true' : undefined}
            className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors ${
              r.id === role.id ? 'border-primary bg-primary/5' : 'hover:bg-accent'
            }`}
          >
            <span>
              <span className="flex items-center gap-1 font-medium">
                {r.isImmutable ? <Lock className="size-3" aria-label="Protected" /> : null}
                {r.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {r.isImmutable ? 'All permissions' : `${r.permissionKeys.length} permissions`} · {r.userCount} users
              </span>
            </span>
            {r.isCustom ? (
              <Badge variant="info" className="text-[10px]">
                Custom
              </Badge>
            ) : r.isCustomised ? (
              <Badge variant="warning" className="text-[10px]">
                Edited
              </Badge>
            ) : null}
          </button>
        ))}
      </nav>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Shield className="size-4" /> {role.name}
                {role.isCustom ? (
                  <Badge variant="info">Custom role</Badge>
                ) : role.isCustomised ? (
                  <Badge variant="warning">Customised</Badge>
                ) : (
                  <Badge variant="muted">Default</Badge>
                )}
              </h2>
              {role.description ? <p className="text-sm text-muted-foreground">{role.description}</p> : null}
              <p className="text-xs text-muted-foreground">
                {readOnly
                  ? 'Super Admin always has every permission and cannot be edited.'
                  : role.isCustom
                    ? 'Created by your team. It grants exactly the permissions ticked below.'
                    : role.isCustomised
                      ? 'This role differs from the platform defaults and is no longer updated automatically.'
                      : 'Follows the platform defaults. Saving changes marks it as customised.'}
              </p>
            </div>
            {!readOnly ? (
              <div className="flex flex-wrap gap-2">
                {role.isCustom ? (
                  <Button variant="outline" size="sm" onClick={() => setEditing(role)}>
                    <Pencil className="mr-1 size-3.5" /> Edit details
                  </Button>
                ) : null}
                {role.isCustom ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={role.userCount > 0}
                    title={
                      role.userCount > 0
                        ? `Remove this role from its ${role.userCount} user${role.userCount === 1 ? '' : 's'} first`
                        : undefined
                    }
                    onClick={() => setDeleting(role)}
                  >
                    <Trash2 className="mr-1 size-3.5" /> Delete
                  </Button>
                ) : null}
                {!role.matchesDefaults ? (
                  <Button variant="outline" size="sm" disabled={reset.isPending} onClick={() => void onReset()}>
                    <RotateCcw className="mr-1 size-3.5" /> Restore defaults
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!dirty}
                  onClick={() => setDraft(new Set(role.permissionKeys))}
                >
                  Discard
                </Button>
                <Button size="sm" disabled={!dirty || save.isPending} onClick={() => void onSave()}>
                  {save.isPending ? 'Saving…' : `Save (${draft.size})`}
                </Button>
              </div>
            ) : null}
          </div>

          {!readOnly ? (
            <Input
              className="h-9 max-w-sm"
              placeholder="Filter permissions"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="Filter permissions"
            />
          ) : null}

          {readOnly ? null : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {groups.map((g) => {
                const keys = g.permissions.map((p) => p.key);
                const onCount = keys.filter((k) => draft.has(k)).length;
                return (
                  <fieldset key={g.resource} className="rounded-md border p-3">
                    <legend className="flex w-full items-center justify-between px-1 text-xs font-semibold uppercase tracking-wide">
                      <span>{humanizeEnum(g.resource)}</span>
                    </legend>
                    <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>
                        {onCount}/{keys.length}
                      </span>
                      <span className="space-x-2">
                        <button type="button" className="hover:underline" onClick={() => toggleGroup(keys, true)}>
                          All
                        </button>
                        <button type="button" className="hover:underline" onClick={() => toggleGroup(keys, false)}>
                          None
                        </button>
                      </span>
                    </div>
                    <div className="space-y-1">
                      {g.permissions.map((p) => {
                        const disabled = !canToggle(p.key);
                        return (
                          <label
                            key={p.key}
                            className={`flex items-start gap-2 text-xs ${disabled ? 'opacity-50' : 'cursor-pointer'}`}
                            title={disabled ? 'You do not hold this permission' : p.key}
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={draft.has(p.key)}
                              disabled={disabled}
                              onChange={() => toggle(p.key)}
                            />
                            <span>
                              <span className="font-mono">{p.action}</span>
                              {p.description ? (
                                <span className="block text-muted-foreground">{p.description}</span>
                              ) : null}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateRoleModal
        open={creating}
        onOpenChange={setCreating}
        roles={roles.data ?? []}
        onCreated={(r) => setRoleId(r.id)}
      />
      <EditRoleDialog role={editing} onClose={() => setEditing(null)} />
      <DeleteRoleDialog
        role={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={() => setRoleId(null)}
      />
    </div>
  );
}

function EditRoleDialog({ role, onClose }: { role: RoleView | null; onClose: () => void }) {
  const update = useUpdateRole();
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');

  React.useEffect(() => {
    setName(role?.name ?? '');
    setDescription(role?.description ?? '');
  }, [role]);

  if (!role) return null;
  const trimmed = name.trim();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (trimmed.length < 2) return;
    try {
      // An empty description clears it.
      await update.mutateAsync({ id: role.id, name: trimmed, description: description.trim() });
      toast.success(`${trimmed} updated`);
      onClose();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to update role'));
    }
  };

  return (
    <Modal open onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <ModalContent className="max-w-md">
        <form onSubmit={(e) => void submit(e)} className="space-y-4">
          <ModalHeader>
            <ModalTitle>Edit {role.name}</ModalTitle>
            <ModalDescription>Renaming doesn’t change who holds the role or what it grants.</ModalDescription>
          </ModalHeader>

          <div className="space-y-1.5">
            <Label htmlFor="edit-role-name">Name</Label>
            <Input
              id="edit-role-name"
              required
              minLength={2}
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-role-description">Description (optional)</Label>
            <Input
              id="edit-role-description"
              maxLength={300}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <ModalFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={trimmed.length < 2 || update.isPending}>
              {update.isPending ? 'Saving…' : 'Save'}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}

function DeleteRoleDialog({
  role,
  onClose,
  onDeleted,
}: {
  role: RoleView | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const remove = useDeleteRole();
  if (!role) return null;

  const submit = async () => {
    try {
      await remove.mutateAsync(role.id);
      toast.success(`${role.name} deleted`);
      onDeleted();
      onClose();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to delete role'));
    }
  };

  return (
    <Modal open onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <ModalContent className="max-w-md">
        <ModalHeader>
          <ModalTitle>Delete {role.name}?</ModalTitle>
          <ModalDescription>This can’t be undone. No users hold this role.</ModalDescription>
        </ModalHeader>
        <ModalFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={remove.isPending} onClick={() => void submit()}>
            {remove.isPending ? 'Deleting…' : 'Delete role'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
