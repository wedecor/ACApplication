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

import { useCreateVendor } from '@/hooks/use-inventory';

export default function NewVendorPage() {
  const router = useRouter();
  const create = useCreateVendor();

  const [companyName, setCompanyName] = React.useState('');
  const [contactPerson, setContactPerson] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [gstin, setGstin] = React.useState('');
  const [paymentTermsDays, setPaymentTermsDays] = React.useState('30');
  const [city, setCity] = React.useState('');
  const [state, setState] = React.useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyName.trim()) {
      toast.error('Company name is required');
      return;
    }
    try {
      const created = await create.mutateAsync({
        companyName: companyName.trim(),
        contactPerson: contactPerson.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        gstin: gstin.trim() || undefined,
        paymentTermsDays: Number.parseInt(paymentTermsDays, 10) || 0,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
      });
      toast.success(`Created vendor ${created.companyName}`);
      router.push(`/vendors/${created.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create vendor');
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/vendors"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to vendors
      </Link>

      <header>
        <h1 className="text-xl font-semibold tracking-tight">New vendor</h1>
        <p className="text-sm text-muted-foreground">
          Supplier code is auto-generated if not provided.
        </p>
      </header>

      <form onSubmit={(e) => void submit(e)}>
        <Card>
          <CardHeader>
            <CardTitle>Vendor details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="company">Company name</Label>
              <Input
                id="company"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact">Contact person</Label>
              <Input
                id="contact"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gstin">GSTIN</Label>
              <Input id="gstin" value={gstin} onChange={(e) => setGstin(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="terms">Payment terms (days)</Label>
              <Input
                id="terms"
                type="number"
                min={0}
                value={paymentTermsDays}
                onChange={(e) => setPaymentTermsDays(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input id="state" value={state} onChange={(e) => setState(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 flex gap-3">
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Creating…' : 'Create vendor'}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/vendors">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
