import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { ServiceDetail } from '@/components/sections/service-detail';
import { JsonLd } from '@/components/seo/json-ld';
import { CITIES, getCityBySlug } from '@/content/cities';
import { RESERVED_TOP_LEVEL_SLUGS } from '@/content/reserved-slugs';
import { getAllServiceSlugs, getServiceBySlug } from '@/content/services';
import { fetchPublicStats } from '@/lib/public-api';
import { localBusinessJsonLd } from '@/lib/seo/json-ld';
import { buildMetadata, uniqKeywords } from '@/lib/seo/metadata';
import { formatNumber } from '@/lib/utils';

interface PageProps {
  params: Promise<{ city: string; service: string }>;
}

/**
 * Generates *static* params for every (city × service) cell, which is
 * the matrix Google indexes most heavily. With 3 live cities and 8
 * services that's 24 routes; we keep the matrix small but high-value.
 *
 * We intentionally pre-render only `isLive` cities — non-live cities
 * still resolve at runtime but aren't pre-built.
 */
export function generateStaticParams() {
  const services = getAllServiceSlugs();
  const cities = CITIES.filter((c) => c.isLive).map((c) => c.slug);
  return cities.flatMap((city) => services.map((service) => ({ city, service })));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city: citySlug, service: serviceSlug } = await params;
  if (RESERVED_TOP_LEVEL_SLUGS.has(citySlug)) return {};
  const city = getCityBySlug(citySlug);
  const service = getServiceBySlug(serviceSlug);
  if (!city || !service) return {};
  const title = `${service.name} in ${city.name} — Same-Day, ₹299 Visit Fee`;
  const description = `Book ${service.name.toLowerCase()} in ${city.name}. ${formatNumber(city.completedBookings)}+ repairs. Verified technicians, 30-day warranty.`;
  return buildMetadata({
    title,
    description,
    path: `/${city.slug}/${service.slug}`,
    keywords: uniqKeywords(service.keywords, [
      `${service.name.toLowerCase()} ${city.name.toLowerCase()}`,
      `${service.name.toLowerCase()} near me ${city.name.toLowerCase()}`,
    ]),
  });
}

export const revalidate = 3600;

export default async function CityServicePage({ params }: PageProps) {
  const { city: citySlug, service: serviceSlug } = await params;
  if (RESERVED_TOP_LEVEL_SLUGS.has(citySlug)) return notFound();
  const city = getCityBySlug(citySlug);
  const service = getServiceBySlug(serviceSlug);
  if (!city || !service) return notFound();
  const stats = await fetchPublicStats({ revalidate: 300 });

  const heading = `${service.name} in ${city.name}`;
  const description = `${service.description} Serving ${city.areas
    .slice(0, 4)
    .map((a) => a.name)
    .join(', ')} and ${city.areas.length - 4}+ more neighbourhoods in ${city.name}.`;

  return (
    <>
      <Breadcrumbs
        items={[
          { name: 'Home', href: '/' },
          { name: city.name, href: `/${city.slug}` },
          { name: service.name, href: `/${city.slug}/${service.slug}` },
        ]}
      />
      <ServiceDetail
        service={service}
        city={city}
        pathname={`/${city.slug}/${service.slug}`}
        heading={heading}
        description={description}
        bookingsToday={stats.bookingsToday}
      />
      <JsonLd data={localBusinessJsonLd(city)} />
    </>
  );
}
