'use client';

import { motion } from 'framer-motion';
import { CheckCircle2, Quote, Star } from 'lucide-react';

import type { CustomerReview } from '@/content/reviews';
import { REVIEWS } from '@/content/reviews';

/**
 * Vertical scroll-aware testimonial grid. We render real reviews — no
 * carousel — because (a) Google indexes the text and (b) carousels hurt
 * accessibility.
 */
export function Testimonials({
  /** Curated subset (city / service page). */
  reviews = REVIEWS,
  title = 'What customers say',
}: {
  reviews?: CustomerReview[];
  title?: string;
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Reviews</p>
        <h2 className="mt-1 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          {title}
        </h2>
        <p className="mt-3 text-base text-muted-foreground">
          From actual booking-linked customers. We never edit, gate or filter ratings — only
          remove personally-identifying info from public display.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {reviews.map((review, idx) => (
          <motion.article
            key={review.id}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.35, delay: idx * 0.04 }}
            className="relative flex flex-col gap-4 rounded-2xl border border-border bg-card p-6"
            itemScope
            itemType="https://schema.org/Review"
          >
            <Quote className="absolute right-4 top-4 size-6 text-muted-foreground/20" aria-hidden />
            <header className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {review.authorInitials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold" itemProp="author">
                  {review.author}
                </p>
                {review.location ? (
                  <p className="truncate text-xs text-muted-foreground">{review.location}</p>
                ) : null}
              </div>
            </header>
            <div
              className="flex items-center gap-0.5"
              aria-label={`${review.rating} out of 5 stars`}
              itemProp="reviewRating"
              itemScope
              itemType="https://schema.org/Rating"
            >
              <meta itemProp="ratingValue" content={String(review.rating)} />
              <meta itemProp="bestRating" content="5" />
              {Array.from({ length: review.rating }).map((_, i) => (
                <Star key={i} className="size-4 fill-amber-400 text-amber-400" aria-hidden />
              ))}
            </div>
            <p className="text-sm text-foreground/90" itemProp="reviewBody">
              {review.body}
            </p>
            <footer className="mt-auto flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
              <time dateTime={review.publishedAt} itemProp="datePublished">
                {new Date(review.publishedAt).toLocaleDateString('en-IN', {
                  month: 'short',
                  year: 'numeric',
                })}
              </time>
              {review.verified ? (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-3" aria-hidden /> Verified
                </span>
              ) : null}
            </footer>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
