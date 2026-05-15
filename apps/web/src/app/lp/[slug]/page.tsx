import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  MessageCircle,
  Phone,
  ShieldCheck,
  Star,
} from 'lucide-react';

import { BookingForm } from '@/components/booking/booking-form';
import { Faq } from '@/components/sections/faq';
import { Testimonials } from '@/components/home/testimonials';
import { JsonLd } from '@/components/seo/json-ld';
import { getCityBySlug } from '@/content/cities';
import { SITE_FAQS } from '@/content/faqs';
import { getAllLandingSlugs, getLandingBySlug } from '@/content/landing-pages';
import { aggregateRating } from '@/content/reviews';
import { getServiceByCategory } from '@/content/services';
import { siteConfig } from '@/env';
import { faqJsonLd, serviceJsonLd } from '@/lib/seo/json-ld';
import { buildMetadata } from '@/lib/seo/metadata';
import { substituteKeyword } from '@/lib/utils';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ kw?: string }>;
}

export function generateStaticParams() {
  return getAllLandingSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const lp = getLandingBySlug(slug);
  if (!lp) return {};
  return buildMetadata({
    title: lp.seo.title,
    description: lp.seo.description,
    path: `/lp/${lp.slug}`,
    noindex: true,
  });
}

export default async function LandingPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { kw } = await searchParams;
  const lp = getLandingBySlug(slug);
  if (!lp) return notFound();
  const service = getServiceByCategory(lp.serviceCategory);
  const city = lp.citySlug ? getCityBySlug(lp.citySlug) : null;
  const headline = substituteKeyword(lp.heading, kw, lp.dynamicHeadlineFallback);
  const overall = aggregateRating();

  return (
    <>
      {/* Minimal branded ribbon */}
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              {siteConfig.shortName.slice(0, 2)}
            </span>
            <span className="text-sm">{siteConfig.name}</span>
          </Link>
          <a
            href={`tel:${siteConfig.supportPhone}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground"
          >
            <Phone className="size-3.5" aria-hidden /> {siteConfig.supportPhone}
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-primary/[0.04] via-background to-background">
        <div className="mx-auto grid max-w-7xl items-start gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-2">
          <div>
            {lp.urgency ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                <AlertCircle className="size-3.5" aria-hidden /> {lp.urgency}
              </div>
            ) : null}

            <h1 className="mt-4 text-balance text-4xl font-bold tracking-tight sm:text-5xl">
              {headline}
            </h1>

            <p className="mt-3 max-w-xl text-balance text-base text-muted-foreground sm:text-lg">
              {lp.subheading}
            </p>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {lp.trustBadges.map((badge) => (
                <div key={badge.label} className="rounded-xl border border-border bg-card p-3">
                  <p className="text-sm font-semibold">{badge.label}</p>
                  {badge.sublabel ? (
                    <p className="text-xs text-muted-foreground">{badge.sublabel}</p>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden />
                <span className="font-semibold text-foreground">{overall.rating}</span> · 26,400
                reviews
              </span>
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="size-4 text-emerald-600" aria-hidden /> 30-day warranty
              </span>
            </div>
          </div>

          {/* Form card — sticky on desktop so it stays in view as user scrolls */}
          <aside id="form" className="lg:sticky lg:top-4">
            <div className="rounded-3xl border border-border bg-card p-2 shadow-xl ring-1 ring-primary/10">
              <Suspense fallback={<div className="min-h-[400px]" />}>
                <BookingForm />
              </Suspense>
            </div>
          </aside>
        </div>
      </section>

      {/* Steps */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        <h2 className="text-center text-balance text-3xl font-bold tracking-tight">How it works</h2>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {lp.steps.map((step, idx) => (
            <div key={step.title} className="relative rounded-2xl border border-border bg-card p-5">
              <span className="absolute -top-3 left-5 inline-flex size-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {idx + 1}
              </span>
              <h3 className="mt-2 text-base font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="border-y border-border bg-muted/20">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
          <h2 className="text-center text-balance text-3xl font-bold tracking-tight">
            Transparent pricing
          </h2>
          <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
            <table className="w-full divide-y divide-border text-sm">
              <thead className="bg-muted/30 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Service</th>
                  <th className="px-4 py-2 text-right">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lp.pricingHighlights.map((p) => (
                  <tr key={p.label}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{p.label}</p>
                      {p.note ? <p className="text-xs text-muted-foreground">{p.note}</p> : null}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{p.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Before / after */}
      {lp.beforeAfter ? (
        <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
          <h2 className="text-center text-balance text-3xl font-bold tracking-tight">
            {lp.beforeAfter.title}
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {[lp.beforeAfter.before, lp.beforeAfter.after].map((p, idx) => (
              <figure key={idx} className="rounded-2xl border border-border bg-card p-3">
                <div className="aspect-video w-full overflow-hidden rounded-xl bg-muted">
                  {/* Image placeholder — use next/image once production
                     photography is in hand. */}
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    {idx === 0 ? 'Before' : 'After'}
                  </div>
                </div>
                <figcaption className="mt-3 text-sm text-muted-foreground">{p.caption}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      {/* Testimonials */}
      <Testimonials />

      {/* FAQ */}
      <Faq items={service?.faqs ?? SITE_FAQS} includeJsonLd={false} />

      {/* Sticky bottom CTA — visible always on mobile, hides on form scroll */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-stretch gap-px border-t border-border bg-background/95 backdrop-blur sm:hidden">
        <a
          href={`tel:${siteConfig.supportPhone}`}
          className="flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium"
        >
          <Phone className="size-4" aria-hidden /> Call
        </a>
        <a
          href="#form"
          className="flex flex-[1.5] items-center justify-center gap-2 bg-primary py-3 text-sm font-semibold text-primary-foreground"
        >
          <CheckCircle2 className="size-4" aria-hidden /> {lp.primaryCta}
        </a>
      </div>

      <footer className="border-t border-border bg-muted/40 px-4 py-6 text-center text-xs text-muted-foreground sm:px-6">
        <p>
          © {new Date().getFullYear()} {siteConfig.companyLegalName}. All rights reserved.{' '}
          <Link href="/privacy" className="underline hover:text-foreground">
            Privacy
          </Link>{' '}
          ·{' '}
          <Link href="/terms" className="underline hover:text-foreground">
            Terms
          </Link>
        </p>
      </footer>

      {service ? (
        <JsonLd
          data={[
            serviceJsonLd({
              service,
              city,
              url: `/lp/${lp.slug}`,
              aggregateRating: { rating: overall.rating, count: overall.count * 800 },
            }),
            faqJsonLd(service.faqs.length ? service.faqs : SITE_FAQS),
          ]}
        />
      ) : null}

      {/* WhatsApp button at fixed bottom-right, conversion-tuned variant */}
      <a
        href={`https://wa.me/${siteConfig.whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(
          'Hi! Saw your ad. Please share availability.',
        )}`}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-20 right-4 z-20 flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-white shadow-lg ring-1 ring-black/10 hover:scale-105 sm:bottom-6 sm:right-6"
        aria-label="Chat on WhatsApp"
      >
        <MessageCircle className="size-5" aria-hidden />
        <span className="hidden text-sm font-semibold sm:inline">Chat on WhatsApp</span>
      </a>
    </>
  );
}

export const revalidate = 3600;
