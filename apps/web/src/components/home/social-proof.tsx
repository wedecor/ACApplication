'use client';

import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

import { AnimatedCounter } from '@/components/home/animated-counter';

function formatReviewCount(n: number): string {
  return n.toLocaleString('en-IN');
}

function formatRating(n: number): string {
  return n.toFixed(1);
}

export interface SocialProofProps {
  households?: number;
  repairs?: number;
  cities?: number;
  rating?: number;
  reviewCount?: number;
}

export function SocialProof({
  households = 25_000,
  repairs = 130_000,
  cities = 12,
  rating = 4.9,
  reviewCount = 18_000,
}: SocialProofProps) {
  const stats: {
    label: string;
    value: number;
    suffix: string;
    isRating?: boolean;
  }[] = [
    { label: 'Households served', value: households, suffix: '+' },
    { label: 'Repairs completed', value: repairs, suffix: '+' },
    { label: 'Cities live', value: cities, suffix: '' },
    { label: 'Average rating', value: rating, suffix: '', isRating: true },
  ];

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
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-4 py-1.5 text-sm font-medium text-amber-200">
            <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden />
            <span>
              {rating} rated by{' '}
              <AnimatedCounter value={reviewCount} formatter={formatReviewCount} />+
              customers
            </span>
          </div>
          <h2 className="mt-6 text-balance text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
            Trusted by{' '}
            <span className="bg-gradient-to-r from-violet-300 to-blue-400 bg-clip-text text-transparent">
              <AnimatedCounter value={households} />+ households
            </span>{' '}
            across India
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Real bookings, verified reviews, and enterprise operations behind every visit.
          </p>
        </motion.div>

        <div className="mt-12 grid grid-cols-2 gap-6 lg:grid-cols-4">
          {stats.map((stat, idx) => (
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
                  <>
                    <AnimatedCounter value={stat.value} />
                    {stat.suffix}
                  </>
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
