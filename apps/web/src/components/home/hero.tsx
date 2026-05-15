'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Check, Phone, Shield, Sparkles, Star, Zap } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@ac/ui';

import { OperationalDashboard } from '@/components/home/operational-dashboard';
import { CITIES, getLiveCities } from '@/content/cities';
import { SERVICES } from '@/content/services';
import { siteConfig } from '@/env';
import { Events, track } from '@/lib/analytics';
import { buildWhatsAppLink, WhatsAppTemplates } from '@/lib/whatsapp';
import { cn, formatNumber } from '@/lib/utils';

const TRUST_CHIPS = [
  { icon: Shield, label: 'No advance payment' },
  { icon: Check, label: 'Verified technicians' },
  { icon: Zap, label: 'Service in 60 mins' },
  { icon: Sparkles, label: '30-day warranty' },
] as const;

const HERO_SERVICES = [
  'ac-repair',
  'refrigerator-repair',
  'washing-machine-repair',
  'microwave-repair',
  'chimney-cleaning',
  'geyser-repair',
] as const;

interface HeroProps {
  bookingsToday: number;
  defaultCitySlug?: string;
  defaultServiceSlug?: string;
  rating?: number;
  reviewCount?: number;
}

export function Hero({
  bookingsToday,
  defaultCitySlug,
  defaultServiceSlug,
  rating = 4.9,
  reviewCount = 18_000,
}: HeroProps) {
  const [city, setCity] = useState(defaultCitySlug ?? siteConfig.defaultCity);
  const [service, setService] = useState(defaultServiceSlug ?? 'ac-repair');
  const liveCities = getLiveCities();
  const heroServices = SERVICES.filter((s) =>
    (HERO_SERVICES as readonly string[]).includes(s.slug),
  );

  const bookHref = `/book?service=${encodeURIComponent(service)}&city=${encodeURIComponent(city)}`;
  const emergencyHref = `/book?service=${encodeURIComponent(service)}&city=${encodeURIComponent(city)}&urgency=emergency`;

  return (
    <section className="relative min-h-[90vh] overflow-hidden border-b border-white/[0.06] bg-zinc-950">
      {/* Background layers */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-violet-950/40 via-zinc-950 to-zinc-950" />
      <motion.div
        className="pointer-events-none absolute -left-32 top-0 size-[480px] rounded-full bg-violet-600/20 blur-[120px]"
        animate={{ opacity: [0.4, 0.6, 0.4], scale: [1, 1.05, 1] }}
        transition={{ duration: 8, repeat: Infinity }}
      />
      <motion.div
        className="pointer-events-none absolute -right-24 top-1/4 size-[400px] rounded-full bg-blue-600/15 blur-[100px]"
        animate={{ opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 10, repeat: Infinity, delay: 1 }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage:
            'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <motion.div
        className="pointer-events-none absolute inset-0"
        animate={{ opacity: [0.15, 0.25, 0.15] }}
        transition={{ duration: 6, repeat: Infinity }}
      >
        {[...Array(6)].map((_, i) => (
          <motion.span
            key={i}
            className="absolute size-1 rounded-full bg-violet-400/60"
            style={{
              left: `${15 + i * 14}%`,
              top: `${20 + (i % 3) * 25}%`,
            }}
            animate={{ y: [0, -12, 0], opacity: [0.2, 0.8, 0.2] }}
            transition={{ duration: 4 + i * 0.5, repeat: Infinity, delay: i * 0.3 }}
          />
        ))}
      </motion.div>

      <motion.div
        className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] lg:gap-10 lg:py-24"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="flex flex-wrap items-center gap-3"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-100 sm:text-sm">
              <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
              {rating} · {formatNumber(reviewCount)}+ reviews
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-400 backdrop-blur-sm">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              {formatNumber(bookingsToday)} bookings today
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="mt-6 text-balance text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[3.25rem] xl:text-6xl"
          >
            Same-day appliance repair from{' '}
            <motion.span
              className="bg-gradient-to-r from-violet-300 via-violet-200 to-blue-400 bg-clip-text text-transparent"
              animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              style={{ backgroundSize: '200% auto' }}
            >
              verified experts
            </motion.span>
            .
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-zinc-400 sm:text-lg"
          >
            AC, fridge, washing machine & more — book in 60 seconds. WhatsApp quotes, live tracking,
            AI dispatch, and a 30-day warranty. Pay only after the job.
          </motion.p>

          {/* Premium booking panel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mt-8 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-5"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Book in 60 seconds
            </p>

            <motion.div
              className="mt-3 flex flex-wrap gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
            >
              {heroServices.map((s) => (
                <button
                  key={s.slug}
                  type="button"
                  onClick={() => setService(s.slug)}
                  className={cn(
                    'rounded-full px-3.5 py-2 text-xs font-medium transition-all sm:text-sm',
                    service === s.slug
                      ? 'bg-gradient-to-r from-violet-600 to-violet-500 text-white shadow-lg shadow-violet-500/25'
                      : 'bg-white/5 text-zinc-400 ring-1 ring-white/10 hover:bg-white/10 hover:text-zinc-200',
                  )}
                >
                  {s.name.replace(' Repair', '').replace(' Service', '').replace(' Cleaning', '')}
                </button>
              ))}
            </motion.div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-stretch">
              <label className="sr-only" htmlFor="hero-city">
                City
              </label>
              <select
                id="hero-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="h-12 flex-1 rounded-xl border border-white/10 bg-zinc-900/80 px-4 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              >
                {liveCities.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
                {CITIES.filter((c) => !c.isLive).map((c) => (
                  <option key={c.slug} value={c.slug} disabled>
                    {c.name} (soon)
                  </option>
                ))}
              </select>

              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  asChild
                  size="lg"
                  className="h-12 w-full min-w-[160px] rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-base font-semibold shadow-lg shadow-violet-600/30 hover:shadow-violet-500/40 sm:w-auto"
                >
                  <Link
                    href={bookHref}
                    onClick={() =>
                      track(Events.CtaClick, { location: 'hero', label: 'book', service, city })
                    }
                  >
                    Book now
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </Button>
              </motion.div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {TRUST_CHIPS.map((chip) => (
                <div
                  key={chip.label}
                  className="flex items-center gap-2 text-[11px] text-zinc-500 sm:text-xs"
                >
                  <chip.icon className="size-3.5 shrink-0 text-violet-400/80" aria-hidden />
                  {chip.label}
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="mt-6 flex flex-wrap items-center gap-3"
          >
            <Button
              asChild
              variant="outline"
              size="lg"
              className="rounded-xl border-white/15 bg-transparent text-zinc-200 hover:bg-white/5"
            >
              <Link
                href={buildWhatsAppLink({ message: WhatsAppTemplates.general() })}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track(Events.WhatsAppClick, { location: 'hero' })}
              >
                WhatsApp quote
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="lg"
              className="rounded-xl text-zinc-400 hover:text-white"
            >
              <Link
                href={emergencyHref}
                onClick={() => track(Events.EmergencyClick, { location: 'hero' })}
              >
                <Zap className="size-4 text-amber-400" aria-hidden />
                Emergency · 60 min
              </Link>
            </Button>
            <a
              href={`tel:${siteConfig.supportPhone}`}
              className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
              onClick={() => track(Events.CallClick, { location: 'hero' })}
            >
              <Phone className="size-3.5" aria-hidden />
              {siteConfig.supportPhone}
            </a>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative lg:mt-0"
        >
          <OperationalDashboard />
        </motion.div>
      </motion.div>
    </section>
  );
}
