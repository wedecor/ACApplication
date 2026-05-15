'use client';

import { motion } from 'framer-motion';
import {
  BadgeCheck,
  Bot,
  FileText,
  MapPin,
  MessageCircle,
  Mic,
  Receipt,
  Shield,
  Sparkles,
  Wallet,
} from 'lucide-react';

const ADVANTAGES = [
  {
    icon: BadgeCheck,
    title: 'Verified technicians',
    description: 'Background-checked pros with skill ratings, not gig-marketplace randoms.',
    highlight: true,
  },
  {
    icon: Bot,
    title: 'AI-powered dispatch',
    description: 'Smart routing assigns the nearest qualified expert in under 90 seconds.',
    highlight: false,
  },
  {
    icon: MapPin,
    title: 'Live GPS tracking',
    description: 'See your technician on the map — ETA updates and direct call.',
    highlight: false,
  },
  {
    icon: MessageCircle,
    title: 'Instant WhatsApp quote',
    description: 'Approve pricing on WhatsApp before any work starts. No surprises.',
    highlight: true,
  },
  {
    icon: Wallet,
    title: 'Transparent pricing',
    description: 'Upfront visit fee, itemised repair quote, pay only after the job.',
    highlight: false,
  },
  {
    icon: Mic,
    title: 'Service recording',
    description: 'Optional visit notes and photos for warranty and quality audits.',
    highlight: false,
  },
  {
    icon: Receipt,
    title: 'Digital invoices',
    description: 'GST-ready invoices on email and WhatsApp — expense-friendly.',
    highlight: false,
  },
  {
    icon: Shield,
    title: '30-day warranty',
    description: 'Parts and labour covered. Free revisit if the same issue returns.',
    highlight: true,
  },
] as const;

const LEGACY = [
  'Unverified freelancers',
  'Manual phone dispatch',
  'Hidden charges',
  'No live tracking',
  'Cash-only, no invoice',
  'No service warranty',
];

export function WhyChooseUs() {
  return (
    <section className="relative overflow-hidden border-y border-border bg-zinc-950 py-20 sm:py-28">
      <motion.div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(139,92,246,0.15),transparent)]"
        animate={{ opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 8, repeat: Infinity }}
      />

      <motion.div
        className="pointer-events-none absolute right-0 top-1/2 size-[500px] -translate-y-1/2 rounded-full bg-blue-600/10 blur-[100px]"
        animate={{ x: [0, 20, 0] }}
        transition={{ duration: 12, repeat: Infinity }}
      />

      <motion.div
        className="mx-auto max-w-7xl px-4 sm:px-6"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.5 }}
      >
        <div className="mx-auto max-w-2xl text-center">
          <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-violet-400">
            <Sparkles className="size-3.5" aria-hidden />
            Why AC Platform
          </p>
          <h2 className="mt-4 text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Operations intelligence,{' '}
            <span className="bg-gradient-to-r from-violet-300 to-blue-400 bg-clip-text text-transparent">
              not just a phone number.
            </span>
          </h2>
          <p className="mt-4 text-base text-zinc-400 sm:text-lg">
            We built the stack Urban Company wishes they had — dispatch, tracking, quotes, and
            warranty in one platform.
          </p>
        </div>

        <div className="mt-16 grid gap-10 lg:grid-cols-[1fr_340px] lg:items-start">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {ADVANTAGES.map((item, idx) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.4, delay: idx * 0.05 }}
                whileHover={{ y: -2 }}
                className={`group relative rounded-2xl border p-5 transition-colors ${
                  item.highlight
                    ? 'border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-transparent'
                    : 'border-white/[0.06] bg-white/[0.02] hover:border-white/10'
                }`}
              >
                <div
                  className={`flex size-10 items-center justify-center rounded-xl ${
                    item.highlight
                      ? 'bg-violet-500/20 text-violet-300'
                      : 'bg-white/5 text-zinc-400 group-hover:text-violet-300'
                  }`}
                >
                  <item.icon className="size-5" aria-hidden />
                </div>
                <h3 className="mt-4 text-base font-semibold text-white">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">{item.description}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="rounded-2xl border border-white/[0.08] bg-zinc-900/80 p-6 backdrop-blur-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Typical local repair
            </p>
            <ul className="mt-4 space-y-3">
              {LEGACY.map((line) => (
                <li key={line} className="flex items-center gap-2 text-sm text-zinc-500">
                  <span className="size-1.5 shrink-0 rounded-full bg-red-500/60" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
            <motion.div
              className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4"
              animate={{ boxShadow: ['0 0 0 0 rgba(16,185,129,0)', '0 0 24px 0 rgba(16,185,129,0.15)', '0 0 0 0 rgba(16,185,129,0)'] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <div className="flex items-center gap-2 text-emerald-400">
                <FileText className="size-4" aria-hidden />
                <span className="text-sm font-semibold">AC Platform</span>
              </div>
              <p className="mt-2 text-sm text-zinc-400">
                Verified pros, AI dispatch, live tracking, WhatsApp quotes, digital invoices, 30-day
                warranty — enterprise-grade from booking to completion.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
