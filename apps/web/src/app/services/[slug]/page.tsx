import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { ServiceDetail } from '@/components/sections/service-detail';
import { getAllServiceSlugs, getServiceBySlug } from '@/content/services';
import { fetchPublicStats } from '@/lib/public-api';
import { buildMetadata, uniqKeywords } from '@/lib/seo/metadata';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllServiceSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const service = getServiceBySlug(slug);
  if (!service) return {};
  return buildMetadata({
    title: service.heading,
    description: service.description,
    path: `/services/${service.slug}`,
    keywords: uniqKeywords(service.keywords, [
      `${service.name.toLowerCase()} near me`,
      `${service.name.toLowerCase()} cost`,
    ]),
  });
}

export const revalidate = 3600;

export default async function ServicePage({ params }: PageProps) {
  const { slug } = await params;
  const service = getServiceBySlug(slug);
  if (!service) return notFound();
  const stats = await fetchPublicStats({ revalidate: 300 });

  return (
    <>
      <Breadcrumbs
        items={[
          { name: 'Home', href: '/' },
          { name: 'Services', href: '/services' },
          { name: service.name, href: `/services/${service.slug}` },
        ]}
      />
      <ServiceDetail
        service={service}
        pathname={`/services/${service.slug}`}
        heading={service.heading}
        description={service.description}
        bookingsToday={stats.bookingsToday}
      />
    </>
  );
}
