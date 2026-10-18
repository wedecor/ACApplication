'use client';

import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

import { AnimatedCounter } from '@/components/home/animated-counter';
import { aggregateRatingLd, type PublicStats } from '@/lib/public-api';

function formatReviewCount(n: number): string {
  return n.toLocaleString('en-IN');
}

function formatRating(n: number): string {
  return n.toFixed(1);
}

export function SocialProof({ stats }: { stats: PublicStats }) {
  // Real API figures only — a stat with no data is dropped, never invented.
  const rating = aggregateRatingLd(stats);
  const items: { label: string; value: number; isRating?: boolean }[] = [
    stats.customersServed ? { label: 'Households served', value: stats.customersServed } : null,
    stats.completedRepairs ? { label: 'Repairs completed', value: stats.completedRepairs } : null,
    stats.citiesLive ? { label: 'Cities live', value: stats.citiesLive } : null,
    rating ? { label: 'Average rating', value: rating.rating, isRating: true } : null,
  ].filter((i): i is NonNullable<typeof i> => i !== null);
  if (items.length === 0) return null;

  return (
    <section className="relative overflow-hidden border-b border-border bg-zinc-950 py-16 sm:py-20">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(99,102,241,0.12),transparent)]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          {rating ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-4 py-1.5 text-sm font-medium text-amber-200">
              <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden />
              <span>
                {formatRating(rating.rating)} from{' '}
                <AnimatedCounter value={rating.count} formatter={formatReviewCount} /> customer ratings
              </span>
            </div>
          ) : null}
          <h2 className="mt-6 text-balance text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
            {stats.customersServed ? (
              <>
                Trusted by{' '}
                <span className="bg-gradient-to-r from-violet-300 to-blue-400 bg-clip-text text-transparent">
                  <AnimatedCounter value={stats.customersServed} /> households
                </span>
              </>
            ) : (
              'By the numbers'
            )}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Real bookings, verified reviews, and enterprise operations behind every visit.
          </p>
        </motion.div>

        <div className="mt-12 grid grid-cols-2 gap-6 lg:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))]">
          {items.map((stat, idx) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: idx * 0.08 }}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6 text-center backdrop-blur-sm"
            >
              <p className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                {stat.isRating ? (
                  <>
                    <AnimatedCounter value={stat.value} formatter={formatRating} />
                    <span className="text-violet-400"> ★</span>
                  </>
                ) : (
                  <AnimatedCounter value={stat.value} />
                )}
              </p>
              <p className="mt-2 text-sm text-zinc-500">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
