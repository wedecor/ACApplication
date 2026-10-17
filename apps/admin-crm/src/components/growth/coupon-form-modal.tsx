'use client';

import { ServiceCategory } from '@ac/types';
import { Button, Input, ModalFooter } from '@ac/ui';
import * as React from 'react';
import { toast } from 'sonner';

import { Field, NativeSelect } from '@/components/common/form-field';
import { SimpleModal } from '@/components/common/simple-modal';
import { useSaveCoupon } from '@/hooks/use-growth';
import type { Coupon, CouponDiscountType, CouponInput } from '@/lib/api/growth';
import { errorMessage, minorToRupees, rupeesToMinor } from '@/lib/crm-format';

const CATEGORIES = Object.values(ServiceCategory);

function toDateInput(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : '';
}

export function couponValueLabel(c: Pick<Coupon, 'discountType' | 'discountValue' | 'maxDiscountMinor'>): string {
  if (c.discountType === 'PERCENT') {
    const pct = c.discountValue / 100;
    return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(2)}% off${
      c.maxDiscountMinor ? ` (max ₹${(c.maxDiscountMinor / 100).toLocaleString('en-IN')})` : ''
    }`;
  }
  return `₹${(c.discountValue / 100).toLocaleString('en-IN')} off`;
}

export function CouponFormModal({
  open,
  onOpenChange,
  coupon,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  coupon?: Coupon | null;
}) {
  const save = useSaveCoupon();
  const [f, setF] = React.useState({
    code: '',
    description: '',
    discountType: 'PERCENT' as CouponDiscountType,
    value: '',
    maxDiscount: '',
    minOrder: '',
    validFrom: '',
    validUntil: '',
    usageLimit: '',
    perCustomerLimit: '1',
    categories: [] as string[],
    firstBookingOnly: false,
    isActive: true,
  });

  React.useEffect(() => {
    if (!open) return;
    setF({
      code: coupon?.code ?? '',
      description: coupon?.description ?? '',
      discountType: coupon?.discountType ?? 'PERCENT',
      value: coupon
        ? coupon.discountType === 'PERCENT'
          ? String(coupon.discountValue / 100)
          : minorToRupees(coupon.discountValue)
        : '',
      maxDiscount: minorToRupees(coupon?.maxDiscountMinor ?? null),
      minOrder: coupon?.minOrderMinor ? minorToRupees(coupon.minOrderMinor) : '',
      validFrom: toDateInput(coupon?.validFrom),
      validUntil: toDateInput(coupon?.validUntil),
      usageLimit: coupon?.usageLimit ? String(coupon.usageLimit) : '',
      perCustomerLimit: String(coupon?.perCustomerLimit ?? 1),
      categories: coupon?.categories ?? [],
      firstBookingOnly: coupon?.firstBookingOnly ?? false,
      isActive: coupon?.isActive ?? true,
    });
  }, [open, coupon]);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = Number(f.value);
    if (!Number.isFinite(raw) || raw <= 0) {
      toast.error('Enter a discount value greater than zero');
      return;
    }
    if (f.discountType === 'PERCENT' && raw > 100) {
      toast.error('Percent discount cannot exceed 100%');
      return;
    }
    const input: CouponInput = {
      code: f.code.trim().toUpperCase(),
      description: f.description.trim() || undefined,
      discountType: f.discountType,
      // PERCENT → basis points (10% = 1000); FLAT → minor units.
      discountValue: f.discountType === 'PERCENT' ? Math.round(raw * 100) : rupeesToMinor(raw),
      maxDiscountMinor: f.discountType === 'PERCENT' && f.maxDiscount ? rupeesToMinor(f.maxDiscount) : null,
      minOrderMinor: rupeesToMinor(f.minOrder),
      validFrom: f.validFrom ? new Date(f.validFrom).toISOString() : undefined,
      validUntil: f.validUntil ? new Date(`${f.validUntil}T23:59:59`).toISOString() : null,
      usageLimit: f.usageLimit ? Number(f.usageLimit) : null,
      perCustomerLimit: Math.max(1, Number(f.perCustomerLimit) || 1),
      categories: f.categories as CouponInput['categories'],
      firstBookingOnly: f.firstBookingOnly,
      isActive: f.isActive,
    };
    try {
      await save.mutateAsync({ id: coupon?.id, input });
      toast.success(coupon ? 'Coupon updated' : 'Coupon created');
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to save coupon'));
    }
  };

  return (
    <SimpleModal open={open} onOpenChange={onOpenChange} title={coupon ? `Edit ${coupon.code}` : 'New coupon'} className="max-w-2xl">
      <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
        <Field label="Code *">
          <Input
            required
            value={f.code}
            disabled={Boolean(coupon)}
            onChange={(e) => set('code', e.target.value.toUpperCase().replace(/\s+/g, ''))}
            placeholder="MONSOON20"
          />
        </Field>
        <Field label="Description">
          <Input value={f.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <Field label="Discount type">
          <NativeSelect value={f.discountType} onChange={(e) => set('discountType', e.target.value as CouponDiscountType)}>
            <option value="PERCENT">Percent</option>
            <option value="FLAT">Flat amount</option>
          </NativeSelect>
        </Field>
        <Field label={f.discountType === 'PERCENT' ? 'Discount (%) *' : 'Discount (₹) *'}>
          <Input type="number" min="0" step="0.01" required value={f.value} onChange={(e) => set('value', e.target.value)} />
        </Field>
        {f.discountType === 'PERCENT' ? (
          <Field label="Max discount (₹)">
            <Input type="number" min="0" value={f.maxDiscount} onChange={(e) => set('maxDiscount', e.target.value)} />
          </Field>
        ) : null}
        <Field label="Min order (₹)">
          <Input type="number" min="0" value={f.minOrder} onChange={(e) => set('minOrder', e.target.value)} />
        </Field>
        <Field label="Valid from">
          <Input type="date" value={f.validFrom} onChange={(e) => set('validFrom', e.target.value)} />
        </Field>
        <Field label="Valid until">
          <Input type="date" value={f.validUntil} onChange={(e) => set('validUntil', e.target.value)} />
        </Field>
        <Field label="Total usage limit" hint="Blank = unlimited">
          <Input type="number" min="1" value={f.usageLimit} onChange={(e) => set('usageLimit', e.target.value)} />
        </Field>
        <Field label="Per-customer limit">
          <Input type="number" min="1" value={f.perCustomerLimit} onChange={(e) => set('perCustomerLimit', e.target.value)} />
        </Field>
        <Field label="Categories (none selected = all)" className="col-span-2">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => {
              const on = f.categories.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() =>
                    set('categories', on ? f.categories.filter((x) => x !== c) : [...f.categories, c])
                  }
                  className={`rounded-full border px-2.5 py-1 text-xs ${on ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
                >
                  {c.replace(/_/g, ' ')}
                </button>
              );
            })}
          </div>
        </Field>
        <div className="col-span-2 flex gap-6 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={f.firstBookingOnly} onChange={(e) => set('firstBookingOnly', e.target.checked)} />
            First booking only
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={f.isActive} onChange={(e) => set('isActive', e.target.checked)} />
            Active
          </label>
        </div>
        <ModalFooter className="col-span-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            Save
          </Button>
        </ModalFooter>
      </form>
    </SimpleModal>
  );
}
