'use client';

import { Permission, type UserRole } from '@ac/types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Input,
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@ac/ui';
import { LogOut, Pencil, Plus, Power, UserCog } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { LoadError } from '@/components/common/load-error';
import { Pagination } from '@/components/common/pagination';
import { RolePermissionMatrix } from '@/components/users/role-permission-matrix';
import { StaffUserFormModal } from '@/components/users/staff-user-form-modal';
import {
  useAssignableRoles,
  useDeactivateStaffUser,
  useReactivateStaffUser,
  useRevokeStaffSessions,
  useStaffUsers,
} from '@/hooks/use-staff-admin';
import { getAccessToken } from '@/lib/api/auth-token';
import { apiErrorMessage } from '@/lib/api/error-message';
import type { StaffUser, StaffUserListQuery } from '@/lib/api/staff-admin';
import { formatDateTime } from '@/lib/format';
import { humanizeEnum } from '@/lib/labels';
import { hasPermission, readSessionClaims } from '@/lib/rbac/permissions';

export default function UsersPage() {
  const { permissions } = readSessionClaims();
  const canManageRoles = hasPermission(Permission.ROLE_MANAGE, permissions);

  return (
    <section className="space-y-4">
      <header>
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight">
          <UserCog className="size-5" />
          Users &amp; Roles
        </h1>
        <p className="text-sm text-muted-foreground">
          Invite staff, assign roles and control what each role can do.
        </p>
      </header>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Staff users</TabsTrigger>
          {canManageRoles ? <TabsTrigger value="roles">Roles &amp; permissions</TabsTrigger> : null}
        </TabsList>
        <TabsContent value="users">
          <UsersTab />
        </TabsContent>
        {canManageRoles ? (
          <TabsContent value="roles">
            <RolePermissionMatrix />
          </TabsContent>
        ) : null}
      </Tabs>
    </section>
  );
}

function displayName(u: StaffUser): string {
  return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || u.phone || 'Unnamed';
}

function UsersTab() {
  const [query, setQuery] = React.useState<StaffUserListQuery>({ page: 1, pageSize: 20 });
  const [search, setSearch] = React.useState('');
  const { data, isLoading, error } = useStaffUsers(query);
  const { data: roles } = useAssignableRoles();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<StaffUser | null>(null);
  const [deactivating, setDeactivating] = React.useState<StaffUser | null>(null);
  const reactivate = useReactivateStaffUser();
  const revoke = useRevokeStaffSessions();
  const me = readSessionClaims();
  const myId = useMyUserId();

  React.useEffect(() => {
    const t = setTimeout(() => setQuery((q) => ({ ...q, search: search || undefined, page: 1 })), 300);
    return () => clearTimeout(t);
  }, [search]);

  const patch = (p: Partial<StaffUserListQuery>) => setQuery((q) => ({ ...q, ...p, page: 1 }));
  const items = data?.items ?? [];
  const isSuperAdmin = me.roles.includes('SUPER_ADMIN');

  const onReactivate = async (u: StaffUser) => {
    try {
      await reactivate.mutateAsync(u.id);
      toast.success(`${displayName(u)} reactivated`);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to reactivate'));
    }
  };

  const onRevoke = async (u: StaffUser) => {
    try {
      const res = await revoke.mutateAsync(u.id);
      toast.success(
        res.sessionsRevoked ? `Signed ${displayName(u)} out of ${res.sessionsRevoked} session(s)` : 'No active sessions',
      );
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to revoke sessions'));
    }
  };

  const selectCls = 'h-9 rounded-md border bg-background px-2 text-sm';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="h-9 w-64"
            placeholder="Search name, email, phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search users"
          />
          <select
            className={selectCls}
            aria-label="Role"
            value={query.roleKey ?? ''}
            onChange={(e) => patch({ roleKey: (e.target.value || undefined) as UserRole | undefined })}
          >
            <option value="">All roles</option>
            {roles?.map((r) => (
              <option key={r.id} value={r.key}>
                {r.name}
              </option>
            ))}
          </select>
          <select
            className={selectCls}
            aria-label="Status"
            value={query.status ?? ''}
            onChange={(e) => patch({ status: (e.target.value || undefined) as StaffUserListQuery['status'] })}
          >
            <option value="">Any status</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Deactivated</option>
            <option value="PENDING">Pending</option>
          </select>
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={!!query.includeTechnicians}
              onChange={(e) => patch({ includeTechnicians: e.target.checked || undefined })}
            />
            Include technicians
          </label>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="size-4" /> Invite user
        </Button>
      </div>

      {error ? <LoadError label="users" message={apiErrorMessage(error)} /> : null}

      <Card>
        <CardContent className="p-0">
          <Table stackOnMobile>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last login</TableHead>
                <TableHead className="text-right">Sessions</TableHead>
                <TableHead className="sr-only">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <EmptyState icon={UserCog} title="No users match" description="Adjust filters or invite a user." />
                  </TableCell>
                </TableRow>
              ) : (
                items.map((u) => {
                  const isSelf = u.id === myId;
                  const protectedUser = u.roles.some((r) => r.key === 'SUPER_ADMIN') && !isSuperAdmin;
                  const suspended = u.status !== 'ACTIVE';
                  return (
                    <TableRow key={u.id} className={suspended ? 'opacity-60' : undefined}>
                      <TableCell>
                        <p className="font-medium">
                          {displayName(u)} {isSelf ? <span className="text-xs text-muted-foreground">(you)</span> : null}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {[u.phone, u.email].filter(Boolean).join(' · ')}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {u.roles.map((r) => (
                            <Badge key={r.id} variant={r.key === 'SUPER_ADMIN' ? 'default' : 'secondary'} className="text-[10px]">
                              {r.name}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {u.status === 'ACTIVE' ? (
                          <Badge variant="success">Active</Badge>
                        ) : u.status === 'SUSPENDED' ? (
                          <Badge variant="destructive">Deactivated</Badge>
                        ) : (
                          <Badge variant="muted">{humanizeEnum(u.status)}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Never'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{u.activeSessions}</TableCell>
                      <TableCell className="text-right">
                        {protectedUser ? (
                          <span className="text-xs text-muted-foreground">Protected</span>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`Edit ${displayName(u)}`}
                              onClick={() => {
                                setEditing(u);
                                setFormOpen(true);
                              }}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`Sign ${displayName(u)} out everywhere`}
                              title="Sign out everywhere"
                              disabled={revoke.isPending || u.activeSessions === 0}
                              onClick={() => void onRevoke(u)}
                            >
                              <LogOut className="size-4" />
                            </Button>
                            {suspended ? (
                              <Button size="sm" variant="outline" disabled={reactivate.isPending} onClick={() => void onReactivate(u)}>
                                Reactivate
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                aria-label={`Deactivate ${displayName(u)}`}
                                disabled={isSelf}
                                title={isSelf ? "You can't deactivate yourself" : 'Deactivate'}
                                onClick={() => setDeactivating(u)}
                              >
                                <Power className="size-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {data ? (
        <Pagination
          page={data.pagination.page}
          pageSize={data.pagination.pageSize}
          total={data.pagination.total}
          totalPages={data.pagination.totalPages}
          onPageChange={(page) => setQuery((q) => ({ ...q, page }))}
        />
      ) : null}

      <StaffUserFormModal open={formOpen} onOpenChange={setFormOpen} user={editing} />
      <DeactivateUserDialog user={deactivating} onClose={() => setDeactivating(null)} />
    </div>
  );
}

function DeactivateUserDialog({ user, onClose }: { user: StaffUser | null; onClose: () => void }) {
  const deactivate = useDeactivateStaffUser();
  const [reason, setReason] = React.useState('');
  React.useEffect(() => setReason(''), [user?.id]);
  if (!user) return null;

  const submit = async () => {
    try {
      await deactivate.mutateAsync({ id: user.id, reason: reason || undefined });
      toast.success(`${displayName(user)} deactivated and signed out`);
      onClose();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to deactivate'));
    }
  };

  return (
    <Modal open onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <ModalContent className="max-w-md">
        <ModalHeader>
          <ModalTitle>Deactivate {displayName(user)}?</ModalTitle>
          <ModalDescription>They are signed out immediately and cannot log in until reactivated.</ModalDescription>
        </ModalHeader>
        <textarea
          rows={2}
          maxLength={500}
          placeholder="Reason (optional)"
          aria-label="Reason"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <ModalFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={deactivate.isPending} onClick={() => void submit()}>
            {deactivate.isPending ? 'Deactivating…' : 'Deactivate'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

/** Current user id from the access token's `sub` claim (UI hint only — the API enforces self-rules). */
function useMyUserId(): string | null {
  return React.useMemo(() => {
    try {
      const token = getAccessToken();
      if (!token) return null;
      const payload = JSON.parse(atob(token.split('.')[1] ?? '')) as { sub?: string };
      return payload.sub ?? null;
    } catch {
      return null;
    }
  }, []);
}
