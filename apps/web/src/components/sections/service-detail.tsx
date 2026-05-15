import { Check, ShieldCheck, Star } from 'lucide-react';
import Link from 'next/link';

import { Badge, Button } from '@ac/ui';

import type { City } from '@/content/cities';
import { aggregateRating, getReviewsFor } from '@/content/reviews';
import type { Service } from '@/content/services';
import { Hero } from '@/components/home/hero';
import { ServiceProcess } from '@/components/home/service-process';
import { Testimonials } from '@/components/home/testimonials';
import { TrustStrip } from '@/components/home/trust-strip';
import { CtaBand } from '@/components/sections/cta-band';
import { Faq } from '@/components/sections/faq';
import { SITE_FAQS } from '@/content/faqs';
import { JsonLd } from '@/components/seo/json-ld';
import { faqJsonLd, serviceJsonLd } from '@/lib/seo/json-ld';
import { Events, track } from '@/lib/analytics';
import { buildWhatsAppLink, WhatsAppTemplates } from '@/lib/whatsapp';

/**
 * Canonical service-detail renderer. Re-used by:
 *  • `/services/[slug]` (national)
 *  • `/[city]/[service]` (programmatic SEO)
 *  • `/brands/[brand]/[service]` (brand + service combination)
 *
 * All variants share the same body — the only deltas are H1 copy, JSON-LD
 * `areaServed`, and breadcrumb root. Centralising the renderer keeps SEO
 * and conversion tweaks DRY.
 */
export function ServiceDetail({
  service,
  city,
  pathname,
  heading,
  description,
  bookingsToday,
}: {
  service: Service;
  city?: City | null;
  pathname: string;
  heading: string;
  description: string;
  bookingsToday: number;
}) {
  const reviews = getReviewsFor({
    citySlug: city?.slug ?? null,
    serviceSlug: service.slug,
    limit: 6,
  });
  const fallbackReviews = reviews.length === 0
    ? getReviewsFor({ serviceSlug: service.slug, limit: 6 })
    : reviews;
  const overall = aggregateRating();
  const faqs = service.faqs.length ? service.faqs : SITE_FAQS;

  return (
    <>
      <Hero
        bookingsToday={bookingsToday}
        defaultCitySlug={city?.slug}
        defaultServiceSlug={service.slug}
      />

      <TrustStrip
        bookings={130_000}
        cities={3}
        rating={overall.rating}
        reviews={overall.count * 800}
      />

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-20">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[2fr_1fr]">
          <div>
            <Badge variant="muted">{service.name}</Badge>
            <h1 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
              {heading}
            </h1>
            <p className="mt-3 text-balance text-base text-muted-foreground sm:text-lg">
              {description}
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {service.usps.map((usp) => (
                <span
                  key={usp}
                  className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground"
                >
                  <Check className="size-3 text-emerald-600" aria-hidden /> {usp}
                </span>
              ))}
            </div>

            <h2 className="mt-10 text-xl font-semibold">What we fix</h2>
            <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {service.issues.map((issue) => (
                <li
                  key={issue}
                  className="flex items-start gap-2 rounded-md border border-border bg-card p-3 text-sm"
                >
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                  <span>{issue}</span>
                </li>
              ))}
            </ul>

            <h2 className="mt-10 text-xl font-semibold">What&apos;s included</h2>
            <ul className="mt-3 space-y-2">
              {service.inclusions.map((inc) => (
                <li key={inc} className="flex items-start gap-2 text-sm">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <span>{inc}</span>
                </li>
              ))}
            </ul>

            <h2 className="mt-10 text-xl font-semibold">Transparent pricing</h2>
            <div className="mt-3 overflow-hidden rounded-2xl border border-border">
              <table className="w-full divide-y divide-border text-sm">
                <thead className="bg-muted/40 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left">Service</th>
                    <th className="px-4 py-2 text-right">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {service.pricing.map((band) => (
                    <tr key={band.label}>
                      <td className="px-4 py-3">
                        <p className="font-medium">{band.label}</p>
                        <p className="text-xs text-muted-foreground">{band.description}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{band.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {service.brandSlugs.length ? (
              <>
                <h2 className="mt-10 text-xl font-semibold">Brands we service</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {service.brandSlugs.map((slug) => (
                    <Link
                      key={slug}
                      href={`/brands/${slug}` as never}
                      className="inline-flex rounded-full border border-border bg-card px-3 py-1 text-xs font-medium hover:border-primary/40 hover:text-primary"
                    >
                      {slug.toUpperCase()}
                    </Link>
                  ))}
                </div>
              </>
            ) : null}
          </div>

          {/* Sidebar — sticky on desktop */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-primary">
                Book this service
              </p>
              <div className="flex items-center gap-1.5 text-sm">
                <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden />
                <span className="font-semibold">{overall.rating}</span>
                <span className="text-muted-foreground">· 30-day warranty</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Starting at{' '}
                <span className="text-base font-bold text-foreground">
                  {service.pricing[1]?.price ?? service.pricing[0]?.price}
                </span>
                . Pay only after the job.
              </p>
              <Button asChild size="lg">
                <Link
                  href={`/book?service=${service.slug}${city ? `&city=${city.slug}` : ''}`}
                  onClick={() =>
                    track(Events.CtaClick, { location: 'service-detail', label: service.slug })
                  }
                >
                  Book a visit
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link
                  href={buildWhatsAppLink({
                    message: city
                      ? WhatsAppTemplates.city(city, service)
                      : WhatsAppTemplates.service(service),
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => track(Events.WhatsAppClick, { location: 'service-detail' })}
                >
                  Chat on WhatsApp
                </Link>
              </Button>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                <li>· Verified, brand-certified technicians</li>
                <li>· Quote on WhatsApp before any work</li>
                <li>· 30-day service warranty</li>
              </ul>
            </div>
          </aside>
        </div>
      </section>

      <ServiceProcess />

      <Testimonials reviews={fallbackReviews} title={`What customers say about our ${service.name}`} />

      <Faq items={faqs} includeJsonLd={false} title={`FAQs about ${service.name}`} />

      <CtaBand
        title={
          city
            ? `Book ${service.name} in ${city.name} today`
            : `Book ${service.name} today`
        }
      />

      <JsonLd
        data={[
          serviceJsonLd({
            service,
            city,
            url: pathname,
            aggregateRating: { rating: overall.rating, count: overall.count * 800 },
          }),
          faqJsonLd(faqs),
        ]}
      />
    </>
  );
}
