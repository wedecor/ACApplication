'use client';

import type { ServiceCategory } from '@ac/types';
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
import { Plus, Trash2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { useCreateTechnician, useTechnicianFormOptions, useUpdateTechnician } from '@/hooks/use-technicians';
import { apiErrorMessage } from '@/lib/api/error-message';
import type {
  CreateTechnicianInput,
  TechnicianDetail,
  TechnicianDocument,
  Weekday,
  WorkingHours,
} from '@/lib/api/technicians';

const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DEFAULT_HOURS: Record<Weekday, string> = {
  mon: '09:00-18:00',
  tue: '09:00-18:00',
  wed: '09:00-18:00',
  thu: '09:00-18:00',
  fri: '09:00-18:00',
  sat: '10:00-14:00',
  sun: '',
};

interface FormState {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  cityId: string;
  employeeCode: string;
  dailyCapacity: string;
  skills: ServiceCategory[];
  hours: Record<Weekday, string>;
  documents: TechnicianDocument[];
}

function hoursToText(wh: WorkingHours | undefined): Record<Weekday, string> {
  const out = { ...DEFAULT_HOURS };
  if (!wh || Object.keys(wh).length === 0) return out;
  for (const d of WEEKDAYS) out[d] = (wh[d] ?? []).map(([a, b]) => `${a}-${b}`).join(', ');
  return out;
}

/** Parses "09:00-13:00, 14:00-18:00" per day; returns an error string on bad input. */
export function parseHours(text: Record<Weekday, string>): WorkingHours | string {
  const out: WorkingHours = {};
  for (const d of WEEKDAYS) {
    const raw = text[d].trim();
    if (!raw) continue;
    const windows: [string, string][] = [];
    for (const part of raw.split(',')) {
      const m = /^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$/.exec(part.trim());
      if (!m) return `${d.toUpperCase()}: use HH:MM-HH:MM, comma-separated`;
      windows.push([m[1]!, m[2]!]);
    }
    out[d] = windows;
  }
  return out;
}

function initialState(t?: TechnicianDetail): FormState {
  return {
    firstName: t?.user.firstName ?? '',
    lastName: t?.user.lastName ?? '',
    phone: t?.phone ?? '',
    email: t?.user.email ?? '',
    cityId: t?.city.id ?? '',
    employeeCode: t?.employeeCode ?? '',
    dailyCapacity: String(t?.dailyCapacity ?? 8),
    skills: t?.skills ?? [],
    hours: hoursToText(t?.workingHours),
    documents: t?.documents ?? [],
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided the modal edits this technician; otherwise it onboards a new one. */
  technician?: TechnicianDetail;
  onSaved?: (technician: TechnicianDetail) => void;
}

export function TechnicianFormModal({ open, onOpenChange, technician, onSaved }: Props) {
  const isEdit = !!technician;
  const { data: options } = useTechnicianFormOptions();
  const create = useCreateTechnician();
  const update = useUpdateTechnician(technician?.id ?? '');
  const [form, setForm] = React.useState<FormState>(() => initialState(technician));
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setForm(initialState(technician));
      setError(null);
    }
  }, [open, technician]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleSkill = (s: ServiceCategory) =>
    set('skills', form.skills.includes(s) ? form.skills.filter((x) => x !== s) : [...form.skills, s]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.firstName.trim()) return setError('First name is required');
    if (!/^\+\d{8,15}$/.test(form.phone.trim())) return setError('Phone must be E.164, e.g. +919876543210');
    if (!form.cityId) return setError('Select a city');
    if (form.skills.length === 0) return setError('Select at least one skill');
    const hours = parseHours(form.hours);
    if (typeof hours === 'string') return setError(hours);
    const docs = form.documents.filter((d) => d.type.trim() && d.url.trim());

    const payload: CreateTechnicianInput = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim() || undefined,
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      cityId: form.cityId,
      employeeCode: form.employeeCode.trim() || undefined,
      skills: form.skills,
      dailyCapacity: Number(form.dailyCapacity) || 8,
      workingHours: hours,
      documents: docs,
    };

    try {
      const saved = isEdit ? await update.mutateAsync(payload) : await create.mutateAsync(payload);
      toast.success(isEdit ? 'Technician updated' : `Technician onboarded (${saved.employeeCode})`);
      onOpenChange(false);
      onSaved?.(saved);
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to save technician'));
    }
  };

  const pending = create.isPending || update.isPending;

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <ModalHeader>
          <ModalTitle>{isEdit ? `Edit ${technician.fullName}` : 'Add technician'}</ModalTitle>
          <ModalDescription>
            {isEdit
              ? 'Update profile, skills, capacity and documents.'
              : 'Creates a login (OTP to this phone), a technician profile and the Technician role.'}
          </ModalDescription>
        </ModalHeader>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="First name *">
              <Input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
            </Field>
            <Field label="Last name">
              <Input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
            </Field>
            <Field label="Phone (E.164) *">
              <Input
                placeholder="+919876543210"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
              />
            </Field>
            <Field label="Email">
              <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
            </Field>
            <Field label="City *">
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={form.cityId}
                onChange={(e) => set('cityId', e.target.value)}
              >
                <option value="">Select a city</option>
                {options?.cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}, {c.state}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Employee code" hint={isEdit ? undefined : 'Leave blank to auto-generate'}>
              <Input
                placeholder="TECH-00001"
                value={form.employeeCode}
                onChange={(e) => set('employeeCode', e.target.value.toUpperCase())}
              />
            </Field>
            <Field label="Daily capacity (jobs)">
              <Input
                type="number"
                min={1}
                max={30}
                value={form.dailyCapacity}
                onChange={(e) => set('dailyCapacity', e.target.value)}
              />
            </Field>
          </div>

          <fieldset>
            <legend className="mb-2 text-xs font-medium">Skills *</legend>
            <div className="flex flex-wrap gap-2">
              {(options?.skills ?? []).map((s) => {
                const on = form.skills.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleSkill(s)}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      on ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent'
                    }`}
                  >
                    {s.replace(/_/g, ' ')}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-xs font-medium">
              Working hours <span className="font-normal text-muted-foreground">(local time, e.g. 09:00-13:00, 14:00-18:00; blank = off)</span>
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {WEEKDAYS.map((d) => (
                <label key={d} className="flex items-center gap-2 text-xs">
                  <span className="w-10 font-medium uppercase text-muted-foreground">{d}</span>
                  <Input
                    className="h-8"
                    value={form.hours[d]}
                    onChange={(e) => set('hours', { ...form.hours, [d]: e.target.value })}
                  />
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 flex w-full items-center justify-between text-xs font-medium">
              Documents (links to KYC / licence files)
            </legend>
            <div className="space-y-2">
              {form.documents.map((doc, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    className="h-8 w-32"
                    placeholder="Type"
                    value={doc.type}
                    onChange={(e) => {
                      const next = [...form.documents];
                      next[i] = { ...doc, type: e.target.value };
                      set('documents', next);
                    }}
                  />
                  <Input
                    className="h-8 flex-1"
                    placeholder="https://…"
                    value={doc.url}
                    onChange={(e) => {
                      const next = [...form.documents];
                      next[i] = { ...doc, url: e.target.value };
                      set('documents', next);
                    }}
                  />
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={!!doc.verified}
                      onChange={(e) => {
                        const next = [...form.documents];
                        next[i] = { ...doc, verified: e.target.checked };
                        set('documents', next);
                      }}
                    />
                    Verified
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label="Remove document"
                    onClick={() => set('documents', form.documents.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => set('documents', [...form.documents, { type: '', url: '', verified: false }])}
              >
                <Plus className="mr-1 size-4" /> Add document
              </Button>
            </div>
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
              {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Add technician'}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1 block text-xs">{label}</Label>
      {children}
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
