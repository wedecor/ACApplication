'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, MessageCircle, Phone, Star } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Badge, Button, Input, Label } from '@ac/ui';

import { CITIES, getLiveCities } from '@/content/cities';
import { SERVICES } from '@/content/services';
import { siteConfig } from '@/env';
import { captureAttribution, Events, getStoredAttribution, track } from '@/lib/analytics';
import { submitPublicLead } from '@/lib/public-api';
import { buildWhatsAppLink, WhatsAppTemplates } from '@/lib/whatsapp';
import { cn } from '@/lib/utils';

const PHONE_REGEX = /^[+]?\d{8,15}$/;

const Schema = z.object({
  service: z.string().min(1, 'Pick a service'),
  city: z.string().min(1, 'Pick a city'),
  applianceBrand: z.string().optional(),
  issue: z.string().max(2000).optional(),
  customerName: z.string().min(2, 'Enter your name').max(120),
  phone: z
    .string()
    .min(8, 'Enter a valid phone')
    .regex(PHONE_REGEX, 'Use only digits, e.g. 9876543210'),
  whatsappOptIn: z.boolean().default(true),
  addressLine1: z.string().max(200).optional(),
  pincode: z
    .string()
    .regex(/^\d{4,8}$/, 'Enter a valid pincode')
    .optional()
    .or(z.literal('')),
  preferredSlot: z.enum(['NOW', 'TODAY', 'TOMORROW', 'CUSTOM']).default('TODAY'),
  // Honeypot — must be empty.
  hp_url: z.string().max(0).optional(),
});

export type BookingFormValues = z.infer<typeof Schema>;

const STEPS = [
  { id: 'service', label: 'Service' },
  { id: 'contact', label: 'Contact' },
  { id: 'schedule', label: 'Schedule' },
] as const;
type StepId = (typeof STEPS)[number]['id'];

/**
 * Multi-step booking form. Each step is a controlled panel — we keep
 * the entire form's state in one `useForm` so the user can navigate
 * back and forward without losing inputs. Conversion analytics fires
 * `lead_step_completed` per step + `lead_submitted` on success.
 */
export function BookingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<StepId>('service');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successCode, setSuccessCode] = useState<string | null>(null);
  const liveCities = getLiveCities();

  const defaultService = useMemo(() => {
    const s = searchParams.get('service');
    return s && SERVICES.some((x) => x.slug === s) ? s : 'ac-repair';
  }, [searchParams]);
  const defaultCity = useMemo(() => {
    const c = searchParams.get('city');
    return c && CITIES.some((x) => x.slug === c) ? c : siteConfig.defaultCity;
  }, [searchParams]);

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      service: defaultService,
      city: defaultCity,
      applianceBrand: '',
      issue: '',
      customerName: '',
      phone: '',
      whatsappOptIn: true,
      addressLine1: '',
      pincode: '',
      preferredSlot: searchParams.get('urgency') === 'emergency' ? 'NOW' : 'TODAY',
      hp_url: '',
    },
    mode: 'onBlur',
  });

  // Capture UTM / gclid on mount so we can attribute the lead.
  useEffect(() => {
    captureAttribution(new URLSearchParams(searchParams.toString()));
    track(Events.LeadStart, { service: defaultService, city: defaultCity });
  }, [searchParams, defaultService, defaultCity]);

  const advance = async () => {
    let valid = false;
    if (step === 'service') {
      valid = await form.trigger(['service', 'city']);
    } else if (step === 'contact') {
      valid = await form.trigger(['customerName', 'phone']);
    }
    if (!valid) return;
    const next = step === 'service' ? 'contact' : step === 'contact' ? 'schedule' : 'schedule';
    track(Events.LeadStepCompleted, { step });
    setStep(next as StepId);
  };

  const back = () => {
    const prev = step === 'schedule' ? 'contact' : step === 'contact' ? 'service' : 'service';
    setStep(prev as StepId);
  };

  const onSubmit = async (values: BookingFormValues) => {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const service = SERVICES.find((s) => s.slug === values.service);
      const city = CITIES.find((c) => c.slug === values.city);
      const attribution = getStoredAttribution();
      const phone = values.phone.startsWith('+') ? values.phone : `+91${values.phone}`;
      const res = await submitPublicLead({
        customerName: values.customerName,
        phone,
        whatsappNumber: values.whatsappOptIn ? phone : undefined,
        applianceType: service?.category,
        applianceBrand: values.applianceBrand || undefined,
        issueDescription: values.issue || undefined,
        addressLine1: values.addressLine1 || undefined,
        cityLabel: city?.name,
        pincode: values.pincode || undefined,
        source:
          attribution.gclid || attribution.utm_source?.toLowerCase().includes('google')
            ? 'GOOGLE_ADS'
            : 'WEBSITE',
        originUrl: typeof window !== 'undefined' ? window.location.pathname : undefined,
        attribution,
        hp_url: values.hp_url ?? '',
      });
      setSuccessCode(res.leadCode);
      track(Events.LeadSubmitted, {
        service: values.service,
        city: values.city,
        source: res.source,
        leadCode: res.leadCode,
      });
      // Reset form so navigating away then back doesn't show stale fields.
      form.reset();
      router.replace(`/book/success?code=${encodeURIComponent(res.leadCode)}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'We could not submit your request.';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (successCode) {
    return <BookingSuccess code={successCode} />;
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-16">
      {/* Progress strip */}
      <ol className="mb-8 flex items-center gap-2 text-xs font-medium">
        {STEPS.map((s, i) => (
          <li key={s.id} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                'flex size-6 items-center justify-center rounded-full border text-[10px]',
                step === s.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : STEPS.findIndex((x) => x.id === step) > i
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground',
              )}
            >
              {STEPS.findIndex((x) => x.id === step) > i ? '✓' : i + 1}
            </span>
            <span
              className={cn(
                'truncate',
                step === s.id ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 ? (
              <span className="h-px flex-1 bg-border" aria-hidden />
            ) : null}
          </li>
        ))}
      </ol>

      {/* Honeypot — hidden by CSS, bots fill it */}
      <div className="hidden" aria-hidden="true">
        <label>
          URL
          <input type="text" tabIndex={-1} autoComplete="off" {...form.register('hp_url')} />
        </label>
      </div>

      {step === 'service' ? (
        <fieldset className="flex flex-col gap-4">
          <legend className="text-2xl font-bold tracking-tight">What do you need fixed?</legend>
          <div className="grid grid-cols-1 gap-3">
            <Label htmlFor="service">Service</Label>
            <select
              id="service"
              className="h-12 rounded-lg border border-border bg-background px-3 text-sm"
              {...form.register('service')}
            >
              {SERVICES.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <Label htmlFor="city">City</Label>
            <select
              id="city"
              className="h-12 rounded-lg border border-border bg-background px-3 text-sm"
              {...form.register('city')}
            >
              {liveCities.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="applianceBrand">Brand (optional)</Label>
              <Input id="applianceBrand" placeholder="LG, Samsung, IFB…" {...form.register('applianceBrand')} />
            </div>
            <div>
              <Label htmlFor="issue">Describe the issue (optional)</Label>
              <Input id="issue" placeholder="Not cooling, leak, error code…" {...form.register('issue')} />
            </div>
          </div>
        </fieldset>
      ) : null}

      {step === 'contact' ? (
        <fieldset className="flex flex-col gap-4">
          <legend className="text-2xl font-bold tracking-tight">How can we reach you?</legend>
          <div>
            <Label htmlFor="customerName">Your name</Label>
            <Input id="customerName" autoComplete="name" {...form.register('customerName')} />
            {form.formState.errors.customerName ? (
              <p className="mt-1 text-xs text-destructive">{form.formState.errors.customerName.message}</p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="phone">Phone (10 digits)</Label>
            <Input
              id="phone"
              inputMode="tel"
              autoComplete="tel"
              placeholder="9876543210"
              {...form.register('phone')}
            />
            {form.formState.errors.phone ? (
              <p className="mt-1 text-xs text-destructive">{form.formState.errors.phone.message}</p>
            ) : null}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...form.register('whatsappOptIn')} className="size-4 rounded" />
            <span>Send updates on WhatsApp (recommended).</span>
          </label>
        </fieldset>
      ) : null}

      {step === 'schedule' ? (
        <fieldset className="flex flex-col gap-4">
          <legend className="text-2xl font-bold tracking-tight">Where and when?</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr]">
            <div>
              <Label htmlFor="addressLine1">Address (optional)</Label>
              <Input id="addressLine1" {...form.register('addressLine1')} />
            </div>
            <div>
              <Label htmlFor="pincode">Pincode</Label>
              <Input id="pincode" inputMode="numeric" {...form.register('pincode')} />
              {form.formState.errors.pincode ? (
                <p className="mt-1 text-xs text-destructive">{form.formState.errors.pincode.message}</p>
              ) : null}
            </div>
          </div>
          <div>
            <Label htmlFor="preferredSlot">Preferred slot</Label>
            <select
              id="preferredSlot"
              className="h-12 w-full rounded-lg border border-border bg-background px-3 text-sm"
              {...form.register('preferredSlot')}
            >
              <option value="NOW">Right now (60-min response)</option>
              <option value="TODAY">Today, any time</option>
              <option value="TOMORROW">Tomorrow</option>
              <option value="CUSTOM">Custom — we&apos;ll call to confirm</option>
            </select>
          </div>
        </fieldset>
      ) : null}

      {submitError ? (
        <p
          role="alert"
          className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {submitError}
        </p>
      ) : null}

      <div className="mt-8 flex items-center justify-between">
        {step !== 'service' ? (
          <Button type="button" variant="ghost" onClick={back}>
            <ArrowLeft className="size-4" /> Back
          </Button>
        ) : (
          <span />
        )}
        {step !== 'schedule' ? (
          <Button type="button" onClick={advance}>
            Continue <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button type="submit" disabled={submitting} loading={submitting}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            Confirm booking
          </Button>
        )}
      </div>

      {/* Trust strip */}
      <aside className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-muted/30 p-4 text-sm">
        <span className="flex items-center gap-2">
          <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden /> 4.8 / 5 · 26,400+ reviews
        </span>
        <a
          href={buildWhatsAppLink({ message: WhatsAppTemplates.general() })}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
        >
          <MessageCircle className="size-4" aria-hidden /> Prefer WhatsApp?
        </a>
        <a
          href={`tel:${siteConfig.supportPhone}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <Phone className="size-3.5" aria-hidden /> Call {siteConfig.supportPhone}
        </a>
      </aside>
    </form>
  );
}

function BookingSuccess({ code }: { code: string }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-12 text-center sm:px-6 sm:py-20">
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="size-8" aria-hidden />
      </div>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">We&apos;ve got it.</h1>
      <p className="mt-2 text-base text-muted-foreground">
        Booking reference <Badge variant="muted">{code}</Badge>. A dispatcher will call you within
        5 minutes with the next available slot.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button asChild>
          <Link href="/">Back to home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link
            href={buildWhatsAppLink({ message: WhatsAppTemplates.bookingFollowup(code) })}
            target="_blank"
            rel="noopener noreferrer"
          >
            Follow up on WhatsApp
          </Link>
        </Button>
      </div>
    </div>
  );
}
