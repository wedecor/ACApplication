import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { MapPin } from 'lucide-react';

import { Badge } from '@ac/ui';

import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { ServiceGrid } from '@/components/home/service-grid';
import { Testimonials } from '@/components/home/testimonials';
import { TrustStrip } from '@/components/home/trust-strip';
import { CtaBand } from '@/components/sections/cta-band';
import { Faq } from '@/components/sections/faq';
import { JsonLd } from '@/components/seo/json-ld';
import {
  findAreaAnywhere,
  getAllCityAreaSlugs,
} from '@/content/cities';
import { SITE_FAQS } from '@/content/faqs';
import { aggregateRating } from '@/content/reviews';
import { localBusinessJsonLd } from '@/lib/seo/json-ld';
import { buildMetadata } from '@/lib/seo/metadata';

interface PageProps {
  params: Promise<{ area: string }>;
}

export function generateStaticParams() {
  return getAllCityAreaSlugs().map((p) => ({ area: p.areaSlug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { area } = await params;
  const found = findAreaAnywhere(area);
  if (!found) return {};
  const { city, area: a } = found;
  return buildMetadata({
    title: `Appliance Repair in ${a.name}, ${city.name} — Same-Day`,
    description: `Book AC, fridge, washing machine and chimney repair in ${a.name}, ${city.name}. Pincodes: ${a.pincodes.join(', ')}. 30-day warranty.`,
    path: `/areas/${a.slug}`,
    keywords: [
      `appliance repair ${a.name.toLowerCase()}`,
      `ac repair ${a.name.toLowerCase()} ${city.name.toLowerCase()}`,
      `${a.name.toLowerCase()} ${city.name.toLowerCase()}`,
    ],
  });
}

export const revalidate = 3600;

export default async function AreaPage({ params }: PageProps) {
  const { area } = await params;
  const found = findAreaAnywhere(area);
  if (!found) return notFound();
  const { city, area: a } = found;
  const overall = aggregateRating();

  return (
    <>
      <Breadcrumbs
        items={[
          { name: 'Home', href: '/' },
          { name: city.name, href: `/${city.slug}` },
          { name: a.name, href: `/areas/${a.slug}` },
        ]}
      />
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        <Badge variant="muted" className="gap-1.5">
          <MapPin className="size-3.5" aria-hidden /> {a.name}, {city.name}
        </Badge>
        <h1 className="mt-3 text-balance text-4xl font-bold tracking-tight sm:text-5xl">
          Appliance repair in {a.name}, {city.name}
        </h1>
        <p className="mt-3 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
          Same-day service across {a.pincodes.join(', ')}. {city.avgResponseMin}-minute median
          response, 30-day warranty.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          Also serving nearby:{' '}
          {city.areas
            .filter((other) => other.slug !== a.slug)
            .slice(0, 6)
            .map((o, idx, arr) => (
              <span key={o.slug}>
                <Link href={`/areas/${o.slug}` as never} className="underline hover:text-foreground">
                  {o.name}
                </Link>
                {idx < arr.length - 1 ? ', ' : ''}
              </span>
            ))}
        </p>
      </section>

      <TrustStrip
        bookings={Math.round(city.completedBookings / Math.max(city.areas.length, 1))}
        rating={overall.rating}
        reviews={Math.round(city.reviewCount / Math.max(city.areas.length, 1))}
        cities={3}
      />

      <ServiceGrid />
      <Testimonials title={`Reviews from ${city.name}`} />
      <Faq items={SITE_FAQS} />
      <CtaBand title={`Book appliance repair in ${a.name} today`} />
      <JsonLd data={localBusinessJsonLd(city)} />
    </>
  );
}
