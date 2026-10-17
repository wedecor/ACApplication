'use client';

import { Permission } from '@ac/types';
import { Button } from '@ac/ui';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { hasPermission, readSessionClaims } from '@/lib/rbac/permissions';

import { CustomerFormModal } from './customer-form-modal';

export function NewCustomerButton() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [canWrite, setCanWrite] = React.useState(false);
  React.useEffect(() => {
    setCanWrite(hasPermission(Permission.CUSTOMER_WRITE, readSessionClaims().permissions));
  }, []);
  if (!canWrite) return null;
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1 size-4" /> New customer
      </Button>
      <CustomerFormModal
        open={open}
        onOpenChange={setOpen}
        onSaved={(c) => router.push(`/customers/${c.id}`)}
      />
    </>
  );
}
