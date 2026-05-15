import type { Metadata } from 'next';

import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { Testimonials } from '@/components/home/testimonials';
import { CtaBand } from '@/components/sections/cta-band';
import { JsonLd } from '@/components/seo/json-ld';
import { aggregateRating, REVIEWS } from '@/content/reviews';
import { reviewJsonLd } from '@/lib/seo/json-ld';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Customer Reviews — Verified, Booking-Linked',
  description:
    'Read real customer reviews from booking-linked services. Average 4.8/5 across 26,000+ verified reviews.',
  path: '/reviews',
});

export default function ReviewsPage() {
  const overall = aggregateRating();
  return (
    <>
      <Breadcrumbs items={[{ name: 'Home', href: '/' }, { name: 'Reviews', href: '/reviews' }]} />
      <header className="border-b border-border bg-muted/20">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Verified reviews</p>
          <h1 className="mt-2 text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            {overall.rating}/5 across 26,400+ ratings
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-balance text-muted-foreground">
            Every review on this page is from an actual booking-linked customer. We don&apos;t edit,
            gate or filter star ratings — only redact personally-identifying info.
          </p>
        </div>
      </header>
      <Testimonials title="All reviews" />
      <CtaBand />
      <JsonLd data={REVIEWS.slice(0, 20).map(reviewJsonLd)} />
    </>
  );
}
