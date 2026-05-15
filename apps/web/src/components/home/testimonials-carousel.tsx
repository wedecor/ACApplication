'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, ChevronLeft, ChevronRight, Quote, Star } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import type { CustomerReview } from '@/content/reviews';
import { REVIEWS } from '@/content/reviews';
import { getServiceBySlug } from '@/content/services';

const AUTO_MS = 6000;

export function TestimonialsCarousel({
  reviews = REVIEWS,
  title = 'Loved by households across India',
}: {
  reviews?: CustomerReview[];
  title?: string;
}) {
  const [index, setIndex] = useState(0);
  const count = reviews.length;

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % count);
  }, [count]);

  const prev = useCallback(() => {
    setIndex((i) => (i - 1 + count) % count);
  }, [count]);

  useEffect(() => {
    if (count <= 1) return;
    const t = setInterval(next, AUTO_MS);
    return () => clearInterval(t);
  }, [count, next]);

  const review = reviews[index];
  if (!review) return null;

  const serviceName = review.serviceSlug
    ? getServiceBySlug(review.serviceSlug)?.name
    : null;

  return (
    <section className="relative overflow-hidden bg-background py-20 sm:py-28">
      <motion.div
        className="pointer-events-none absolute left-1/2 top-0 size-[600px] -translate-x-1/2 rounded-full bg-violet-500/5 blur-[100px]"
        animate={{ opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 8, repeat: Infinity }}
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="text-sm font-semibold uppercase tracking-widest text-violet-500">Reviews</p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
          <p className="mt-3 text-muted-foreground">
            Booking-linked customers only. We never edit ratings — only remove PII.
          </p>
        </motion.div>

        <div className="relative mx-auto mt-14 max-w-3xl">
          <AnimatePresence mode="wait">
            <motion.article
              key={review.id}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="relative rounded-3xl border border-border bg-card p-8 shadow-xl sm:p-10"
              itemScope
              itemType="https://schema.org/Review"
            >
              <Quote
                className="absolute right-6 top-6 size-10 text-muted-foreground/15"
                aria-hidden
              />

              <header className="flex items-center gap-4">
                <motion.div
                  className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-blue-500/10 text-lg font-bold text-violet-600 dark:text-violet-300"
                  whileHover={{ scale: 1.05 }}
                >
                  {review.authorInitials}
                </motion.div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  <p className="text-lg font-semibold" itemProp="author">
                    {review.author}
                  </p>
                  {review.location ? (
                    <p className="text-sm text-muted-foreground">{review.location}</p>
                  ) : null}
                  {serviceName ? (
                    <p className="mt-1 text-xs font-medium text-violet-500">{serviceName}</p>
                  ) : null}
                </motion.div>
              </header>

              <div
                className="mt-5 flex gap-0.5"
                aria-label={`${review.rating} out of 5 stars`}
                itemProp="reviewRating"
                itemScope
                itemType="https://schema.org/Rating"
              >
                <meta itemProp="ratingValue" content={String(review.rating)} />
                <meta itemProp="bestRating" content="5" />
                {Array.from({ length: review.rating }).map((_, i) => (
                  <Star key={i} className="size-5 fill-amber-400 text-amber-400" aria-hidden />
                ))}
              </div>

              <p className="mt-5 text-lg leading-relaxed text-foreground/90" itemProp="reviewBody">
                &ldquo;{review.body}&rdquo;
              </p>

              <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5 text-sm text-muted-foreground">
                <time dateTime={review.publishedAt} itemProp="datePublished">
                  {new Date(review.publishedAt).toLocaleDateString('en-IN', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </time>
                {review.verified ? (
                  <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="size-4" aria-hidden />
                    Verified booking
                  </span>
                ) : null}
              </footer>
            </motion.article>
          </AnimatePresence>

          {count > 1 ? (
            <>
              <button
                type="button"
                onClick={prev}
                className="absolute left-0 top-1/2 -translate-x-2 -translate-y-1/2 rounded-full border border-border bg-background p-2.5 shadow-md transition hover:bg-muted sm:-translate-x-14"
                aria-label="Previous review"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                onClick={next}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 rounded-full border border-border bg-background p-2.5 shadow-md transition hover:bg-muted sm:translate-x-14"
                aria-label="Next review"
              >
                <ChevronRight className="size-5" />
              </button>

              <div className="mt-8 flex justify-center gap-2">
                {reviews.map((r, i) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setIndex(i)}
                    className={`h-2 rounded-full transition-all ${
                      i === index ? 'w-8 bg-violet-500' : 'w-2 bg-muted-foreground/30'
                    }`}
                    aria-label={`Go to review ${i + 1}`}
                    aria-current={i === index}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>

        {/* Thumbnail strip — desktop */}
        <div className="mt-12 hidden gap-4 overflow-x-auto pb-2 sm:flex sm:justify-center">
          {reviews.slice(0, 5).map((r, i) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setIndex(i)}
              className={`max-w-[200px] shrink-0 rounded-xl border p-4 text-left text-sm transition-all ${
                index === i
                  ? 'border-violet-500/40 bg-violet-500/5'
                  : 'border-border bg-card/50 opacity-70 hover:opacity-100'
              }`}
            >
              <p className="font-medium line-clamp-1">{r.author}</p>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.title}</p>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
