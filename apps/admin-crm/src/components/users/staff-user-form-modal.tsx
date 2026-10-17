'use client';

import type { UserRole } from '@ac/types';
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

import {
  useAssignableRoles,
  useCreateStaffUser,
  useSetStaffUserRoles,
  useUpdateStaffUser,
} from '@/hooks/use-staff-admin';
import { apiErrorMessage } from '@/lib/api/error-message';
import type { StaffUser } from '@/lib/api/staff-admin';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit mode when provided. */
  user?: StaffUser | null;
}

const PROFILE_ROLES: UserRole[] = ['TECHNICIAN', 'CUSTOMER'];

export function StaffUserFormModal({ open, onOpenChange, user }: Props) {
  const isEdit = !!user;
  const { data: roles } = useAssignableRoles();
  const create = useCreateStaffUser();
  const update = useUpdateStaffUser();
  const setRoles = useSetStaffUserRoles();

  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [roleKeys, setRoleKeys] = React.useState<UserRole[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setFirstName(user?.firstName ?? '');
    setLastName(user?.lastName ?? '');
    setPhone(user?.phone ?? '');
    setEmail(user?.email ?? '');
    setRoleKeys((user?.roles ?? []).map((r) => r.key).filter((k) => !PROFILE_ROLES.includes(k)));
    setError(null);
  }, [open, user]);

  const toggle = (k: UserRole) =>
    setRoleKeys((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!firstName.trim()) return setError('First name is required');
    if (!phone.trim() && !email.trim()) return setError('Provide a phone number or email for OTP sign-in');
    if (phone.trim() && !/^\+\d{8,15}$/.test(phone.trim())) return setError('Phone must be E.164, e.g. +919876543210');
    if (roleKeys.length === 0) return setError('Select at least one role');

    const profile = {
      firstName: firstName.trim(),
      lastName: lastName.trim() || undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
    };
    try {
      if (isEdit) {
        await update.mutateAsync({ id: user.id, input: profile });
        const current = user.roles.map((r) => r.key).filter((k) => !PROFILE_ROLES.includes(k)).sort();
        if (current.join() !== [...roleKeys].sort().join()) {
          await setRoles.mutateAsync({ id: user.id, roleKeys });
        }
        toast.success('User updated');
      } else {
        await create.mutateAsync({ ...profile, roleKeys });
        toast.success('Staff user created — they can sign in with an OTP');
      }
      onOpenChange(false);
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to save user'));
    }
  };

  const pending = create.isPending || update.isPending || setRoles.isPending;

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-xl">
        <ModalHeader>
          <ModalTitle>{isEdit ? 'Edit staff user' : 'Invite staff user'}</ModalTitle>
          <ModalDescription>
            Staff sign in to the CRM with a one-time code sent to their phone or email.
          </ModalDescription>
        </ModalHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-1 block text-xs" htmlFor="su-first">First name *</Label>
              <Input id="su-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-xs" htmlFor="su-last">Last name</Label>
              <Input id="su-last" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-xs" htmlFor="su-phone">Phone (E.164)</Label>
              <Input id="su-phone" placeholder="+919876543210" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-xs" htmlFor="su-email">Email</Label>
              <Input id="su-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>

          <fieldset>
            <legend className="mb-2 text-xs font-medium">Roles *</legend>
            <div className="space-y-2">
              {(roles ?? []).map((r) => {
                const checked = roleKeys.includes(r.key);
                const disabled = !r.grantable;
                return (
                  <label
                    key={r.id}
                    className={`flex items-start gap-2 rounded-md border p-2 text-sm ${disabled ? 'opacity-50' : 'cursor-pointer hover:bg-accent/50'}`}
                    title={disabled ? 'This role includes permissions you do not hold' : undefined}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggle(r.key)}
                    />
                    <span>
                      <span className="font-medium">{r.name}</span>
                      {r.description ? <span className="block text-xs text-muted-foreground">{r.description}</span> : null}
                      {disabled ? <span className="block text-xs text-muted-foreground">You can&apos;t grant this role.</span> : null}
                    </span>
                  </label>
                );
              })}
            </div>
            {user?.technicianId ? (
              <p className="mt-2 text-xs text-muted-foreground">
                This user is also a technician — the Technician role is managed from the Technicians page and is kept.
              </p>
            ) : null}
          </fieldset>

          {error ? (
            <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <ModalFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create user'}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
