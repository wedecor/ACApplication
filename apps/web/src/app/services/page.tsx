import type { Metadata } from 'next';

import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { ServiceGrid } from '@/components/home/service-grid';
import { CtaBand } from '@/components/sections/cta-band';
import { Faq } from '@/components/sections/faq';
import { SITE_FAQS } from '@/content/faqs';
import { SERVICES } from '@/content/services';
import { siteConfig } from '@/env';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Home Appliance Services — AC, Fridge, Washing Machine & More',
  description: `Same-day repair, installation and AMC for AC, refrigerator, washing machine, microwave, geyser and chimney. Trained technicians, 30-day warranty.`,
  path: '/services',
  keywords: SERVICES.flatMap((s) => s.keywords).slice(0, 20),
});

export default function ServicesIndex() {
  return (
    <>
      <Breadcrumbs items={[{ name: 'Home', href: '/' }, { name: 'Services', href: '/services' }]} />
      <header className="border-b border-border bg-muted/20">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
          <h1 className="max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            Every home appliance — repaired, installed and maintained.
          </h1>
          <p className="mt-3 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
            Pick a service. Choose a 2-hour slot. A {siteConfig.name} technician arrives the same
            day with a transparent WhatsApp quote and a 30-day warranty.
          </p>
        </div>
      </header>
      <ServiceGrid />
      <Faq items={SITE_FAQS} />
      <CtaBand />
    </>
  );
}
