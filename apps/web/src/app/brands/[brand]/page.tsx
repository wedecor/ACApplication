import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge, Button } from '@ac/ui';

import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { ServiceProcess } from '@/components/home/service-process';
import { Testimonials } from '@/components/home/testimonials';
import { TrustStrip } from '@/components/home/trust-strip';
import { CtaBand } from '@/components/sections/cta-band';
import { Faq } from '@/components/sections/faq';
import { JsonLd } from '@/components/seo/json-ld';
import { BRANDS, getBrandBySlug } from '@/content/brands';
import { SITE_FAQS } from '@/content/faqs';
import { aggregateRating } from '@/content/reviews';
import { getServiceByCategory, type Service } from '@/content/services';
import { productJsonLd } from '@/lib/seo/json-ld';
import { buildMetadata } from '@/lib/seo/metadata';
import { buildWhatsAppLink, WhatsAppTemplates } from '@/lib/whatsapp';
import { formatNumber } from '@/lib/utils';

interface PageProps {
  params: Promise<{ brand: string }>;
}

export function generateStaticParams() {
  return BRANDS.map((b) => ({ brand: b.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { brand } = await params;
  const b = getBrandBySlug(brand);
  if (!b) return {};
  return buildMetadata({
    title: `${b.name} Repair & Service — All Models, 30-Day Warranty`,
    description: `${b.tagline} ${formatNumber(b.repairsCompleted)}+ ${b.name} appliances serviced. Verified technicians, genuine parts.`,
    path: `/brands/${b.slug}`,
    keywords: [
      `${b.name.toLowerCase()} ac repair`,
      `${b.name.toLowerCase()} service center`,
      `${b.name.toLowerCase()} repair near me`,
    ],
  });
}

export const revalidate = 3600;

export default async function BrandPage({ params }: PageProps) {
  const { brand: brandSlug } = await params;
  const brand = getBrandBySlug(brandSlug);
  if (!brand) return notFound();
  const services = brand.services
    .map((cat) => getServiceByCategory(cat))
    .filter((s): s is Service => Boolean(s));
  const overall = aggregateRating();

  return (
    <>
      <Breadcrumbs
        items={[
          { name: 'Home', href: '/' },
          { name: 'Brands', href: '/brands' },
          { name: brand.name, href: `/brands/${brand.slug}` },
        ]}
      />

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        <Badge variant="muted">{brand.name}</Badge>
        <h1 className="mt-3 text-balance text-4xl font-bold tracking-tight sm:text-5xl">
          {brand.name} repair, installation & service.
        </h1>
        <p className="mt-3 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
          {brand.tagline} {formatNumber(brand.repairsCompleted)}+ {brand.name} appliances
          serviced across India.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/book">Book {brand.name} service</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link
              href={buildWhatsAppLink({ message: WhatsAppTemplates.brand(brand) })}
              target="_blank"
              rel="noopener noreferrer"
            >
              Chat on WhatsApp
            </Link>
          </Button>
        </div>
      </section>

      <TrustStrip
        bookings={brand.repairsCompleted}
        rating={overall.rating}
        reviews={overall.count * 800}
        cities={3}
      />

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h2 className="text-balance text-3xl font-bold tracking-tight">
          Services we offer for {brand.name}
        </h2>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <Link
              key={service.slug}
              href={`/services/${service.slug}` as never}
              className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
            >
              <h3 className="font-semibold">{brand.name} {service.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{service.description}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                Starting at {service.pricing[0]?.price ?? '₹299'}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {brand.commonErrorCodes?.length ? (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <h2 className="text-balance text-3xl font-bold tracking-tight">
            Common {brand.name} error codes
          </h2>
          <div className="mt-6 overflow-hidden rounded-2xl border border-border">
            <table className="w-full divide-y divide-border text-sm">
              <thead className="bg-muted/40 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Code</th>
                  <th className="px-4 py-2 text-left">Meaning</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {brand.commonErrorCodes.map((err) => (
                  <tr key={err.code}>
                    <td className="px-4 py-3 font-mono font-semibold">{err.code}</td>
                    <td className="px-4 py-3 text-muted-foreground">{err.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <ServiceProcess />
      <Testimonials title={`What ${brand.name} customers say`} />
      <Faq items={SITE_FAQS} />
      <CtaBand title={`Book ${brand.name} service today`} />

      <JsonLd
        data={productJsonLd({
          name: `${brand.name} appliance repair`,
          description: brand.tagline,
          image: '/og.png',
          url: `/brands/${brand.slug}`,
          aggregateRating: { rating: overall.rating, count: overall.count * 800 },
          offers: services.map((s) => ({
            name: `${brand.name} ${s.name}`,
            price: Number(s.pricing[0]?.price.replace(/[^\d]/g, '') ?? 0),
          })),
        })}
      />
    </>
  );
}
