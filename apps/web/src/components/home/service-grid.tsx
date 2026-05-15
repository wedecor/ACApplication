'use client';

import { motion } from 'framer-motion';
import {
  AirVent,
  ArrowRight,
  CookingPot,
  Microwave,
  Refrigerator,
  Tv,
  Wand,
  WashingMachine,
  Wrench,
  Zap,
} from 'lucide-react';
import Link from 'next/link';

import { SERVICES, type Service } from '@/content/services';
import { Events, track } from '@/lib/analytics';

const ICONS: Record<Service['icon'], React.ComponentType<{ className?: string }>> = {
  ac: AirVent,
  fridge: Refrigerator,
  washer: WashingMachine,
  microwave: Microwave,
  geyser: Zap,
  chimney: CookingPot,
  tv: Tv,
  general: Wrench,
};

const GRADIENTS = [
  'from-violet-600/20 via-violet-500/5 to-transparent',
  'from-blue-600/20 via-blue-500/5 to-transparent',
  'from-indigo-600/20 via-indigo-500/5 to-transparent',
  'from-cyan-600/15 via-cyan-500/5 to-transparent',
  'from-purple-600/20 via-purple-500/5 to-transparent',
  'from-sky-600/15 via-sky-500/5 to-transparent',
] as const;

const FEATURED_SLUGS = [
  'ac-repair',
  'refrigerator-repair',
  'washing-machine-repair',
  'microwave-repair',
  'chimney-cleaning',
  'geyser-repair',
] as const;

export function ServiceGrid({
  services = SERVICES.filter((s) => (FEATURED_SLUGS as readonly string[]).includes(s.slug)),
}: {
  services?: Service[];
}) {
  return (
    <section className="relative bg-zinc-950 py-20 sm:py-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_30%_at_50%_100%,rgba(99,102,241,0.08),transparent)]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end"
        >
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
              Our services
            </p>
            <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Every appliance.{' '}
              <span className="text-zinc-500">Every brand.</span> Fixed today.
            </h2>
          </motion.div>
          <Link
            href="/services"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-400 transition hover:text-violet-300"
          >
            All services <ArrowRight className="size-4" aria-hidden />
          </Link>
        </motion.div>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service, idx) => {
            const Icon = ICONS[service.icon] ?? Wand;
            const gradient = GRADIENTS[idx % GRADIENTS.length];

            return (
              <motion.div
                key={service.slug}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.45, delay: idx * 0.06 }}
              >
                <Link
                  href={`/services/${service.slug}`}
                  onClick={() =>
                    track(Events.CtaClick, { location: 'service-grid', label: service.slug })
                  }
                  className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-violet-500/30 hover:shadow-xl hover:shadow-violet-500/10"
                >
                  <div
                    className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 transition-opacity group-hover:opacity-100`}
                  />

                  <div className="relative flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/25 to-blue-500/10 text-violet-300 ring-1 ring-white/10 transition group-hover:scale-105 group-hover:ring-violet-500/30">
                    <Icon className="size-6" aria-hidden />
                  </div>

                  <h3 className="relative mt-5 text-lg font-semibold text-white">{service.name}</h3>
                  <p className="relative mt-2 text-sm leading-relaxed text-zinc-500">
                    {service.usps.slice(0, 2).join(' · ')}
                  </p>

                  <motion.div
                    className="relative mt-6 flex items-center justify-between border-t border-white/[0.06] pt-4"
                    initial={false}
                  >
                    <span className="text-sm font-medium text-zinc-400">
                      {service.pricing[0]?.price ?? 'From ₹299'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-violet-400 opacity-0 transition-opacity group-hover:opacity-100">
                      Book
                      <ArrowRight className="size-4" aria-hidden />
                    </span>
                  </motion.div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
