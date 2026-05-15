import type { Metadata } from 'next';

import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { TechnicianShowcase } from '@/components/home/technician-showcase';
import { TrustStrip } from '@/components/home/trust-strip';
import { CtaBand } from '@/components/sections/cta-band';
import { siteConfig } from '@/env';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: `About ${siteConfig.name}`,
  description: `${siteConfig.name} is rebuilding home-appliance service for India — verified technicians, transparent pricing and a 30-day warranty on every repair.`,
  path: '/about',
});

export default function AboutPage() {
  return (
    <>
      <Breadcrumbs items={[{ name: 'Home', href: '/' }, { name: 'About', href: '/about' }]} />
      <header className="border-b border-border bg-muted/20">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            Rebuilding appliance service for India.
          </h1>
          <p className="mt-3 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
            We&apos;re a team of operators, engineers and field experts on a single mission — to
            make home-appliance service as reliable, transparent and friendly as ordering a meal.
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-3xl space-y-6 px-4 py-12 text-base leading-relaxed text-muted-foreground sm:px-6">
        <p>
          {siteConfig.name} was founded in {siteConfig.companyFoundedYear} to fix three things
          customers had been telling us about home-appliance service for years: unclear pricing,
          slow response, and no accountability.
        </p>
        <p>
          We started with one promise — every repair carries a 30-day service warranty. From
          there we layered in transparent WhatsApp quotes, brand-certified training for every
          technician, GPS-tracked dispatch, and an AMC programme for households who want a single
          maintenance partner.
        </p>
        <p>
          Today, we serve {' '}
          <strong className="text-foreground">130,000+ households</strong> across Bengaluru,
          Mumbai and Delhi NCR, with an average customer rating of <strong>4.8 / 5</strong>.
          We&apos;re expanding to 15+ cities by 2026.
        </p>
      </section>

      <TrustStrip />
      <TechnicianShowcase />
      <CtaBand />
    </>
  );
}
