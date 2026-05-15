import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { ServiceDetail } from '@/components/sections/service-detail';
import { BRANDS, getBrandBySlug } from '@/content/brands';
import { getAllServiceSlugs, getServiceByCategory, getServiceBySlug } from '@/content/services';
import { fetchPublicStats } from '@/lib/public-api';
import { buildMetadata, uniqKeywords } from '@/lib/seo/metadata';

interface PageProps {
  params: Promise<{ brand: string; service: string }>;
}

export function generateStaticParams() {
  const out: Array<{ brand: string; service: string }> = [];
  const allServices = getAllServiceSlugs();
  for (const brand of BRANDS) {
    for (const cat of brand.services) {
      const service = getServiceByCategory(cat);
      if (service && allServices.includes(service.slug)) {
        out.push({ brand: brand.slug, service: service.slug });
      }
    }
  }
  return out;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { brand: brandSlug, service: serviceSlug } = await params;
  const brand = getBrandBySlug(brandSlug);
  const service = getServiceBySlug(serviceSlug);
  if (!brand || !service) return {};
  return buildMetadata({
    title: `${brand.name} ${service.name} — Authorised-Grade Service`,
    description: `Same-day ${brand.name} ${service.name.toLowerCase()} by certified technicians. Genuine spare parts, 30-day warranty.`,
    path: `/brands/${brand.slug}/${service.slug}`,
    keywords: uniqKeywords(service.keywords, [
      `${brand.name.toLowerCase()} ${service.name.toLowerCase()}`,
      `${brand.name.toLowerCase()} ${service.name.toLowerCase()} near me`,
    ]),
  });
}

export const revalidate = 3600;

export default async function BrandServicePage({ params }: PageProps) {
  const { brand: brandSlug, service: serviceSlug } = await params;
  const brand = getBrandBySlug(brandSlug);
  const service = getServiceBySlug(serviceSlug);
  if (!brand || !service) return notFound();

  // Ensure the brand actually services this category.
  if (!brand.services.includes(service.category)) return notFound();

  const stats = await fetchPublicStats({ revalidate: 300 });

  return (
    <>
      <Breadcrumbs
        items={[
          { name: 'Home', href: '/' },
          { name: 'Brands', href: '/brands' },
          { name: brand.name, href: `/brands/${brand.slug}` },
          { name: service.name, href: `/brands/${brand.slug}/${service.slug}` },
        ]}
      />
      <ServiceDetail
        service={service}
        pathname={`/brands/${brand.slug}/${service.slug}`}
        heading={`${brand.name} ${service.name} — Authorised-Grade Service`}
        description={`Same-day ${brand.name} ${service.name.toLowerCase()} by certified technicians. ${service.description}`}
        bookingsToday={stats.bookingsToday}
      />
    </>
  );
}
