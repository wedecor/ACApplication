import type { Metadata } from 'next';

import { Testimonials } from '@/components/home/testimonials';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { CtaBand } from '@/components/sections/cta-band';
import { JsonLd } from '@/components/seo/json-ld';
import { REVIEWS } from '@/content/reviews';
import { aggregateRatingLd, fetchPublicStats } from '@/lib/public-api';
import { reviewJsonLd } from '@/lib/seo/json-ld';
import { buildMetadata } from '@/lib/seo/metadata';
import { formatNumber } from '@/lib/utils';

export const metadata: Metadata = buildMetadata({
  title: 'Customer Reviews — Verified, Booking-Linked',
  description: 'Customer reviews and ratings for our home appliance repair visits.',
  path: '/reviews',
});

export default async function ReviewsPage() {
  const stats = await fetchPublicStats({ revalidate: 300 });
  const rating = aggregateRatingLd(stats);
  return (
    <>
      <Breadcrumbs items={[{ name: 'Home', href: '/' }, { name: 'Reviews', href: '/reviews' }]} />
      <header className="border-b border-border bg-muted/20">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Verified reviews</p>
          <h1 className="mt-2 text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            {rating ? `${rating.rating.toFixed(1)}/5 across ${formatNumber(rating.count)} ratings` : 'Customer reviews'}
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
