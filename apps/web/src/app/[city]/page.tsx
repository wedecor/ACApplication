import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, MapPin } from 'lucide-react';

import { Badge } from '@ac/ui';

import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { Hero } from '@/components/home/hero';
import { ServiceProcess } from '@/components/home/service-process';
import { Testimonials } from '@/components/home/testimonials';
import { TrustStrip } from '@/components/home/trust-strip';
import { CtaBand } from '@/components/sections/cta-band';
import { Faq } from '@/components/sections/faq';
import { JsonLd } from '@/components/seo/json-ld';
import { CITIES, getCityBySlug } from '@/content/cities';
import { SITE_FAQS } from '@/content/faqs';
import { getReviewsFor } from '@/content/reviews';
import { RESERVED_TOP_LEVEL_SLUGS } from '@/content/reserved-slugs';
import { SERVICES } from '@/content/services';
import { fetchPublicStats } from '@/lib/public-api';
import { localBusinessJsonLd } from '@/lib/seo/json-ld';
import { buildMetadata } from '@/lib/seo/metadata';
import { formatNumber } from '@/lib/utils';

interface PageProps {
  params: Promise<{ city: string }>;
}

export function generateStaticParams() {
  return CITIES.map((c) => ({ city: c.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city } = await params;
  if (RESERVED_TOP_LEVEL_SLUGS.has(city)) return {};
  const c = getCityBySlug(city);
  if (!c) return {};
  return buildMetadata({
    title: `Home Appliance Repair in ${c.name} — Same-Day, Verified Technicians`,
    description: `Book AC, fridge, washing machine, microwave and chimney repair in ${c.name}. ${formatNumber(c.completedBookings)}+ services completed. 30-day warranty.`,
    path: `/${c.slug}`,
    keywords: [
      `appliance repair ${c.name.toLowerCase()}`,
      `ac repair ${c.name.toLowerCase()}`,
      `washing machine repair ${c.name.toLowerCase()}`,
      `refrigerator repair ${c.name.toLowerCase()}`,
    ],
  });
}

export const revalidate = 3600;

export default async function CityPage({ params }: PageProps) {
  const { city: citySlug } = await params;
  if (RESERVED_TOP_LEVEL_SLUGS.has(citySlug)) return notFound();
  const city = getCityBySlug(citySlug);
  if (!city) return notFound();
  const stats = await fetchPublicStats({ revalidate: 300 });

  return (
    <>
      <Breadcrumbs
        items={[
          { name: 'Home', href: '/' },
          { name: city.name, href: `/${city.slug}` },
        ]}
      />
      <Hero bookingsToday={stats.bookingsToday} defaultCitySlug={city.slug} />
      <TrustStrip
        bookings={city.completedBookings}
        rating={city.rating}
        reviews={city.reviewCount}
        cities={3}
      />

      {/* City-specific service grid — same components, contextualised copy */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="muted">
            <MapPin className="size-3.5" aria-hidden /> {city.name}, {city.state}
          </Badge>
          <h2 className="mt-2 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Trusted appliance service in {city.name}
          </h2>
          <p className="mt-3 text-base text-muted-foreground">
            We&apos;ve completed {formatNumber(city.completedBookings)} repairs across{' '}
            {city.areas.length} neighbourhoods including {city.areas.slice(0, 4).map((a) => a.name).join(', ')}.
          </p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s) => (
            <Link
              key={s.slug}
              href={`/${city.slug}/${s.slug}` as never}
              className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
            >
              <div>
                <p className="font-semibold">{s.name} in {city.name}</p>
                <p className="text-xs text-muted-foreground">{s.usps.slice(0, 2).join(' · ')}</p>
              </div>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden />
            </Link>
          ))}
        </div>
      </section>

      <ServiceProcess />

      {/* Areas served */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          Areas we serve in {city.name}
        </h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Our technicians cover {city.areas.length} neighbourhoods across {city.name}. Tap an area
          for local service details and pricing.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {city.areas.map((area) => (
            <Link
              key={area.slug}
              href={`/areas/${area.slug}` as never}
              className="inline-flex rounded-full border border-border bg-card px-3 py-1 text-sm transition-colors hover:border-primary/40 hover:text-primary"
            >
              {area.name}
            </Link>
          ))}
        </div>
      </section>

      <Testimonials
        reviews={getReviewsFor({ citySlug: city.slug, limit: 6 })}
        title={`Reviews from ${city.name}`}
      />

      <Faq items={SITE_FAQS} />

      <CtaBand
        title={`Book a technician in ${city.name} today`}
        description={`Median response time: ${city.avgResponseMin} minutes.`}
      />

      <JsonLd data={localBusinessJsonLd(city)} />
    </>
  );
}
