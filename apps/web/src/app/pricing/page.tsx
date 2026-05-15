import type { Metadata } from 'next';
import Link from 'next/link';

import { Badge, Button } from '@ac/ui';

import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { CtaBand } from '@/components/sections/cta-band';
import { Faq } from '@/components/sections/faq';
import { SITE_FAQS } from '@/content/faqs';
import { SERVICES } from '@/content/services';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Pricing — Transparent Repair Rates for Every Appliance',
  description:
    'Upfront, no-surprises pricing for AC, fridge, washing machine, microwave and chimney repairs. ₹299 diagnosis adjusted into the final repair.',
  path: '/pricing',
  keywords: [
    'appliance repair cost',
    'ac repair price',
    'washing machine repair cost',
    'fridge repair charges',
  ],
});

export default function PricingPage() {
  return (
    <>
      <Breadcrumbs items={[{ name: 'Home', href: '/' }, { name: 'Pricing', href: '/pricing' }]} />
      <header className="border-b border-border bg-muted/20">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
          <Badge variant="muted">Transparent pricing</Badge>
          <h1 className="mt-3 text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            One quote on WhatsApp before any work starts.
          </h1>
          <p className="mt-3 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
            Diagnosis visit ₹299, adjusted into the final repair. Real-time parts pricing on the
            WhatsApp quote — no surprises, no inflated bills.
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-5xl space-y-8 px-4 py-12 sm:px-6">
        {SERVICES.map((service) => (
          <article key={service.slug} className="rounded-2xl border border-border bg-card p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">{service.name}</h2>
                <p className="text-sm text-muted-foreground">{service.subheading}</p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/services/${service.slug}`}>Book {service.name}</Link>
              </Button>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {service.pricing.map((band) => (
                <div key={band.label} className="rounded-xl border border-border bg-background p-4">
                  <p className="text-sm font-semibold">{band.label}</p>
                  <p className="text-2xl font-bold text-primary">{band.price}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{band.description}</p>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>

      <Faq items={SITE_FAQS} />
      <CtaBand />
    </>
  );
}
