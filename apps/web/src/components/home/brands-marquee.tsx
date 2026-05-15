'use client';

import { motion } from 'framer-motion';

import { BRANDS } from '@/content/brands';

const FEATURED = BRANDS.slice(0, 14);

export function BrandsMarquee() {
  const doubled = [...FEATURED, ...FEATURED];

  return (
    <section className="border-y border-border/50 bg-muted/20 py-12 sm:py-14" aria-label="Brands we service">
      <div className="mx-auto max-w-7xl px-4 text-center sm:px-6">
        <p className="text-sm font-medium text-muted-foreground">
          Authorised-grade repairs for every major appliance brand
        </p>
      </div>

      <div className="relative mt-8 overflow-hidden">
        <motion.div
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-background to-transparent sm:w-32"
          aria-hidden
        />
        <motion.div
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-background to-transparent sm:w-32"
          aria-hidden
        />

        <motion.div
          className="flex w-max gap-12 px-6"
          animate={{ x: ['0%', '-50%'] }}
          transition={{ duration: 35, repeat: Infinity, ease: 'linear' }}
        >
          {doubled.map((brand, i) => (
            <span
              key={`${brand.slug}-${i}`}
              className="shrink-0 text-lg font-semibold tracking-tight text-muted-foreground/70 transition-colors hover:text-foreground"
            >
              {brand.name}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
