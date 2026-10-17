'use client';

import { ServiceCategory } from '@ac/types';
import { Badge, Input, Skeleton } from '@ac/ui';
import { Users } from 'lucide-react';
import * as React from 'react';

import { Field, NativeSelect } from '@/components/common/form-field';
import { useSegmentRulesPreview } from '@/hooks/use-growth';
import type { AmcStatusRule, SegmentRules } from '@/lib/api/growth';
import { errorMessage, splitTags } from '@/lib/crm-format';
import { humanizeEnum } from '@/lib/labels';

const CATEGORIES = Object.values(ServiceCategory);

function numOrUndef(v: string): number | undefined {
  if (v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined;
}

/** Strip empty arrays / undefined so the preview cache key is stable. */
export function cleanRules(rules: SegmentRules): SegmentRules {
  const out: SegmentRules = {};
  if (rules.cityIds?.length) out.cityIds = rules.cityIds;
  if (rules.tags?.length) out.tags = rules.tags;
  if (rules.categories?.length) out.categories = rules.categories;
  if (rules.minBookings !== undefined) out.minBookings = rules.minBookings;
  if (rules.maxBookings !== undefined) out.maxBookings = rules.maxBookings;
  if (rules.lastBookingBeforeDays !== undefined) out.lastBookingBeforeDays = rules.lastBookingBeforeDays;
  if (rules.amcStatus) out.amcStatus = rules.amcStatus;
  if (rules.applianceWarrantyExpiringInDays !== undefined)
    out.applianceWarrantyExpiringInDays = rules.applianceWarrantyExpiringInDays;
  return out;
}

/**
 * Rules editor for a customer segment with a debounced live preview
 * (member count + sample) from `POST /segments/preview`.
 */
export function SegmentBuilder({
  rules,
  onChange,
}: {
  rules: SegmentRules;
  onChange: (rules: SegmentRules) => void;
}) {
  // Text inputs keep their raw string so users can type freely.
  const [cityText, setCityText] = React.useState((rules.cityIds ?? []).join(', '));
  const [tagText, setTagText] = React.useState((rules.tags ?? []).join(', '));
  const [debounced, setDebounced] = React.useState(() => cleanRules(rules));

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(cleanRules(rules)), 500);
    return () => clearTimeout(t);
  }, [rules]);

  const { data: preview, isFetching, error } = useSegmentRulesPreview(debounced);

  const patch = (p: Partial<SegmentRules>) => onChange({ ...rules, ...p });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tags (any of)" hint="Comma-separated">
          <Input
            value={tagText}
            onChange={(e) => {
              setTagText(e.target.value);
              patch({ tags: splitTags(e.target.value) });
            }}
            placeholder="vip, society"
          />
        </Field>
        <Field label="City ids (any of)" hint="Comma-separated city ids">
          <Input
            value={cityText}
            onChange={(e) => {
              setCityText(e.target.value);
              patch({ cityIds: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) });
            }}
          />
        </Field>
        <Field label="Min bookings">
          <Input
            type="number"
            min="0"
            value={rules.minBookings ?? ''}
            onChange={(e) => patch({ minBookings: numOrUndef(e.target.value) })}
          />
        </Field>
        <Field label="Max bookings">
          <Input
            type="number"
            min="0"
            value={rules.maxBookings ?? ''}
            onChange={(e) => patch({ maxBookings: numOrUndef(e.target.value) })}
          />
        </Field>
        <Field label="No booking in last N days">
          <Input
            type="number"
            min="0"
            value={rules.lastBookingBeforeDays ?? ''}
            onChange={(e) => patch({ lastBookingBeforeDays: numOrUndef(e.target.value) })}
          />
        </Field>
        <Field label="AMC status">
          <NativeSelect
            value={rules.amcStatus ?? ''}
            onChange={(e) => patch({ amcStatus: (e.target.value || undefined) as AmcStatusRule | undefined })}
          >
            <option value="">Any</option>
            <option value="active">Active AMC</option>
            <option value="expired">Expired AMC</option>
            <option value="none">Never had AMC</option>
          </NativeSelect>
        </Field>
        <Field label="Appliance warranty expiring within (days)">
          <Input
            type="number"
            min="0"
            value={rules.applianceWarrantyExpiringInDays ?? ''}
            onChange={(e) => patch({ applianceWarrantyExpiringInDays: numOrUndef(e.target.value) })}
          />
        </Field>
        <div />
        <Field label="Booked categories (any of)" className="col-span-2">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => {
              const on = (rules.categories ?? []).includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() =>
                    patch({
                      categories: on
                        ? (rules.categories ?? []).filter((x) => x !== c)
                        : [...(rules.categories ?? []), c],
                    })
                  }
                  className={`rounded-full border px-2.5 py-1 text-xs ${on ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
                >
                  {humanizeEnum(c)}
                </button>
              );
            })}
          </div>
        </Field>
      </div>

      <aside className="rounded-lg border bg-muted/30 p-3">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Users className="size-4" /> Live preview
          {isFetching ? <span className="text-xs text-muted-foreground">updating…</span> : null}
        </p>
        {error ? (
          <p className="mt-2 text-xs text-destructive">{errorMessage(error, 'Preview failed')}</p>
        ) : !preview ? (
          <Skeleton className="mt-2 h-24 w-full" />
        ) : (
          <>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{preview.count.toLocaleString('en-IN')}</p>
            <p className="text-xs text-muted-foreground">matching customers</p>
            <ul className="mt-3 space-y-1.5 text-sm">
              {preview.sample.slice(0, 10).map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{c.fullName}</span>
                  <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    {c.totalBookings} bk
                    {c.tags.slice(0, 1).map((t) => (
                      <Badge key={t} variant="outline" className="px-1 py-0 text-[10px]">
                        {t}
                      </Badge>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </aside>
    </div>
  );
}
