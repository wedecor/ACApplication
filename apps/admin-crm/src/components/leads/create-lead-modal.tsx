'use client';

import { LeadPriority, LeadSource, ServiceCategory } from '@ac/types';
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
import { Plus } from 'lucide-react';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { useCreateLead } from '@/hooks/use-leads';
import { type CreateLeadInput } from '@/lib/api/leads';

const PRIORITIES = Object.values(LeadPriority);
const SOURCES = Object.values(LeadSource);
const CATEGORIES = Object.values(ServiceCategory);

export function CreateLeadModal() {
  const [open, setOpen] = React.useState(false);
  const { mutateAsync, isPending } = useCreateLead();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateLeadInput>({
    defaultValues: { source: LeadSource.MANUAL, priority: LeadPriority.NORMAL },
  });

  const onSubmit = async (values: CreateLeadInput) => {
    try {
      await mutateAsync({
        ...values,
        tags: typeof values.tags === 'string'
          ? (values.tags as unknown as string).split(',').map((s) => s.trim()).filter(Boolean)
          : values.tags,
      });
      toast.success('Lead created');
      setOpen(false);
      reset();
    } catch (err: unknown) {
      toast.error((err as Error).message ?? 'Failed to create lead');
    }
  };

  return (
    <Modal open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)} size="sm">
        <Plus className="mr-1 size-4" /> New lead
      </Button>
      <ModalContent className="max-w-2xl">
        <ModalHeader>
          <ModalTitle>Create new lead</ModalTitle>
          <ModalDescription>
            Capture a customer enquiry. The dispatcher can qualify and convert it into a booking.
          </ModalDescription>
        </ModalHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3">
          <Field label="Customer name" error={errors.customerName?.message}>
            <Input {...register('customerName', { required: 'Required' })} />
          </Field>
          <Field label="Phone (E.164)" error={errors.phone?.message}>
            <Input placeholder="+919876543210" {...register('phone', { required: 'Required' })} />
          </Field>
          <Field label="WhatsApp number">
            <Input placeholder="+919876543210" {...register('whatsappNumber')} />
          </Field>
          <Field label="Email">
            <Input type="email" {...register('email')} />
          </Field>
          <Field label="Source">
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" {...register('source', { required: true })}>
              {SOURCES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Priority">
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" {...register('priority')}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </Field>
          <Field label="Appliance type">
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" {...register('applianceType')}>
              <option value="">—</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </Field>
          <Field label="Brand">
            <Input {...register('applianceBrand')} />
          </Field>
          <Field label="Address line 1" className="col-span-2">
            <Input {...register('addressLine1')} />
          </Field>
          <Field label="Pincode">
            <Input {...register('pincode')} />
          </Field>
          <Field label="Tags (comma-separated)">
            <Input placeholder="repeat, escalation" {...register('tags' as never)} />
          </Field>
          <Field label="Issue description" className="col-span-2">
            <textarea
              rows={3}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              {...register('issueDescription')}
            />
          </Field>
          <ModalFooter className="col-span-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : 'Create lead'}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}

function Field({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label className="mb-1 block text-xs">{label}</Label>
      {children}
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
