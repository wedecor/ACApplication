'use client';

import type { ServiceCategory } from '@ac/types';
import {
  Button,
  Input,
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from '@ac/ui';
import * as React from 'react';
import { toast } from 'sonner';

import { useSaveAppliance } from '@/hooks/use-repair';
import { type Appliance, humanize, SERVICE_CATEGORIES } from '@/lib/api/repair';

import { dateToIso, errorMessage, Field, isoToDate, NativeSelect, Textarea } from './repair-ui';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Required when creating. */
  customerId?: string;
  appliance?: Appliance | null;
  onSaved?: (appliance: Appliance) => void;
}

export function ApplianceFormModal({ open, onOpenChange, customerId, appliance, onSaved }: Props) {
  const save = useSaveAppliance(appliance?.id);
  const [form, setForm] = React.useState(() => initial(appliance));

  React.useEffect(() => {
    if (open) setForm(initial(appliance));
  }, [open, appliance]);

  const set = (k: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.brand.trim()) {
      toast.error('Brand is required');
      return;
    }
    save.mutate(
      {
        ...(appliance ? {} : { customerId }),
        category: form.category as ServiceCategory,
        brand: form.brand.trim(),
        modelNumber: form.modelNumber.trim() || null,
        serialNumber: form.serialNumber.trim() || null,
        capacity: form.capacity.trim() || null,
        installedLocation: form.installedLocation.trim() || null,
        purchaseDate: dateToIso(form.purchaseDate),
        installDate: dateToIso(form.installDate),
        manufacturerWarrantyUntil: dateToIso(form.manufacturerWarrantyUntil),
        extendedWarrantyUntil: dateToIso(form.extendedWarrantyUntil),
        warrantyProvider: form.warrantyProvider.trim() || null,
        notes: form.notes.trim() || null,
      },
      {
        onSuccess: (saved) => {
          toast.success(appliance ? 'Appliance updated' : 'Appliance registered');
          onSaved?.(saved);
          onOpenChange(false);
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <ModalHeader>
          <ModalTitle>{appliance ? 'Edit appliance' : 'Register appliance'}</ModalTitle>
          <ModalDescription>
            Service history, AMC coverage and warranty checks are tracked per unit.
          </ModalDescription>
        </ModalHeader>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <Field label="Category" htmlFor="ap-category">
            <NativeSelect id="ap-category" value={form.category} onChange={set('category')}>
              {SERVICE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {humanize(c)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Brand" htmlFor="ap-brand">
            <Input id="ap-brand" value={form.brand} onChange={set('brand')} placeholder="Daikin" required />
          </Field>
          <Field label="Model number" htmlFor="ap-model">
            <Input id="ap-model" value={form.modelNumber} onChange={set('modelNumber')} />
          </Field>
          <Field label="Serial number" htmlFor="ap-serial">
            <Input id="ap-serial" value={form.serialNumber} onChange={set('serialNumber')} />
          </Field>
          <Field label="Capacity" htmlFor="ap-capacity">
            <Input id="ap-capacity" value={form.capacity} onChange={set('capacity')} placeholder="1.5 ton / 260 L / 7 kg" />
          </Field>
          <Field label="Installed location" htmlFor="ap-location">
            <Input id="ap-location" value={form.installedLocation} onChange={set('installedLocation')} placeholder="Master bedroom" />
          </Field>
          <Field label="Purchase date" htmlFor="ap-purchase">
            <Input id="ap-purchase" type="date" value={form.purchaseDate} onChange={set('purchaseDate')} />
          </Field>
          <Field label="Install date" htmlFor="ap-install">
            <Input id="ap-install" type="date" value={form.installDate} onChange={set('installDate')} />
          </Field>
          <Field label="Manufacturer warranty until" htmlFor="ap-mfr">
            <Input id="ap-mfr" type="date" value={form.manufacturerWarrantyUntil} onChange={set('manufacturerWarrantyUntil')} />
          </Field>
          <Field label="Extended warranty until" htmlFor="ap-ext">
            <Input id="ap-ext" type="date" value={form.extendedWarrantyUntil} onChange={set('extendedWarrantyUntil')} />
          </Field>
          <Field label="Warranty provider" htmlFor="ap-provider" className="sm:col-span-2">
            <Input id="ap-provider" value={form.warrantyProvider} onChange={set('warrantyProvider')} />
          </Field>
          <Field label="Notes" htmlFor="ap-notes" className="sm:col-span-2">
            <Textarea id="ap-notes" value={form.notes} onChange={set('notes')} rows={3} />
          </Field>
          <ModalFooter className="gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : appliance ? 'Save changes' : 'Register'}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}

function initial(a?: Appliance | null) {
  return {
    category: (a?.category ?? 'AC_REPAIR') as string,
    brand: a?.brand ?? '',
    modelNumber: a?.modelNumber ?? '',
    serialNumber: a?.serialNumber ?? '',
    capacity: a?.capacity ?? '',
    installedLocation: a?.installedLocation ?? '',
    purchaseDate: isoToDate(a?.purchaseDate),
    installDate: isoToDate(a?.installDate),
    manufacturerWarrantyUntil: isoToDate(a?.manufacturerWarrantyUntil),
    extendedWarrantyUntil: isoToDate(a?.extendedWarrantyUntil),
    warrantyProvider: a?.warrantyProvider ?? '',
    notes: a?.notes ?? '',
  };
}
