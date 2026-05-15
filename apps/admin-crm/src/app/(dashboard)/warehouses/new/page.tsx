'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@ac/ui';

import { useCreateWarehouse } from '@/hooks/use-inventory';
import type { WarehouseKind } from '@/lib/api/inventory';

const KINDS: { value: WarehouseKind; label: string }[] = [
  { value: 'CENTRAL', label: 'Central' },
  { value: 'BRANCH', label: 'Branch' },
  { value: 'TRANSIT', label: 'Transit' },
  { value: 'VENDOR_RETURNS', label: 'Vendor returns' },
  { value: 'SCRAP', label: 'Scrap' },
];

export default function NewWarehousePage() {
  const router = useRouter();
  const create = useCreateWarehouse();

  const [code, setCode] = React.useState('');
  const [name, setName] = React.useState('');
  const [kind, setKind] = React.useState<WarehouseKind>('BRANCH');
  const [addressLine1, setAddressLine1] = React.useState('');
  const [pincode, setPincode] = React.useState('');
  const [state, setState] = React.useState('');
  const [gstin, setGstin] = React.useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      toast.error('Code and name are required');
      return;
    }
    try {
      const created = await create.mutateAsync({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        kind,
        addressLine1: addressLine1.trim() || undefined,
        pincode: pincode.trim() || undefined,
        state: state.trim() || undefined,
        gstin: gstin.trim() || undefined,
      });
      toast.success(`Created warehouse ${created.code}`);
      router.push(`/warehouses/${created.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create warehouse');
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/warehouses"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to warehouses
      </Link>

      <header>
        <h1 className="text-xl font-semibold tracking-tight">New warehouse</h1>
        <p className="text-sm text-muted-foreground">
          Add a stock location before creating purchase orders or transfers.
        </p>
      </header>

      <form onSubmit={(e) => void submit(e)}>
        <Card>
          <CardHeader>
            <CardTitle>Warehouse details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="BLR-CENTRAL"
                className="font-mono uppercase"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="kind">Kind</Label>
              <select
                id="kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as WarehouseKind)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input id="state" value={state} onChange={(e) => setState(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pincode">Pincode</Label>
              <Input id="pincode" value={pincode} onChange={(e) => setPincode(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="gstin">GSTIN</Label>
              <Input id="gstin" value={gstin} onChange={(e) => setGstin(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 flex gap-3">
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Creating…' : 'Create warehouse'}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/warehouses">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
