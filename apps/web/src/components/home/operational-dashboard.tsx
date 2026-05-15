'use client';

import { motion } from 'framer-motion';
import {
  Bot,
  Headphones,
  MapPin,
  MessageCircle,
  Navigation,
  Shield,
  Sparkles,
  Wrench,
} from 'lucide-react';

const CARDS = [
  {
    id: 'route',
    icon: Navigation,
    title: 'Technician en route',
    subtitle: 'Suresh K. · 4.9 ★ · 12 yrs',
    status: 'Arriving in 28 min',
    statusTone: 'emerald',
    progress: 72,
    time: 'Live',
    col: 'col-span-2',
    delay: 0,
  },
  {
    id: 'booking',
    icon: Wrench,
    title: 'Live booking',
    subtitle: 'AC not cooling · Whitefield',
    status: 'Slot confirmed 2–4 PM',
    statusTone: 'violet',
    progress: 100,
    time: '2m ago',
    col: '',
    delay: 0.08,
  },
  {
    id: 'whatsapp',
    icon: MessageCircle,
    title: 'WhatsApp quote',
    subtitle: 'Diagnosis ₹299 waived',
    status: '₹2,899 · Approved',
    statusTone: 'emerald',
    progress: 100,
    time: 'Just now',
    col: '',
    delay: 0.16,
  },
  {
    id: 'ai',
    icon: Bot,
    title: 'AI dispatch active',
    subtitle: 'Optimal route · 3 jobs',
    status: 'ETA optimised',
    statusTone: 'violet',
    progress: 45,
    time: 'Live',
    col: '',
    delay: 0.24,
  },
  {
    id: 'tracking',
    icon: MapPin,
    title: 'Live tracking',
    subtitle: 'Customer map view',
    status: 'GPS locked',
    statusTone: 'emerald',
    progress: 88,
    time: 'Live',
    col: '',
    delay: 0.32,
  },
  {
    id: 'support',
    icon: Headphones,
    title: 'Call center',
    subtitle: '2 agents available',
    status: 'Avg wait 12s',
    statusTone: 'violet',
    progress: 60,
    time: 'Live',
    col: '',
    delay: 0.4,
  },
  {
    id: 'warranty',
    icon: Shield,
    title: 'Service warranty',
    subtitle: '30-day parts & labour',
    status: 'Verified',
    statusTone: 'emerald',
    progress: 100,
    time: 'Active',
    col: 'col-span-2',
    delay: 0.48,
  },
] as const;

function PulseDot({ className }: { className?: string }) {
  return (
    <span className={`relative flex size-2 ${className ?? ''}`}>
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
      <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
    </span>
  );
}

function DashboardCard({
  card,
}: {
  card: (typeof CARDS)[number];
}) {
  const Icon = card.icon;
  const isLive = card.time === 'Live';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: card.delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={`group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 shadow-lg shadow-black/20 backdrop-blur-md transition-shadow hover:border-violet-500/30 hover:shadow-violet-500/10 ${card.col}`}
    >
      <motion.div
        className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-violet-500/20 blur-2xl opacity-0 transition-opacity group-hover:opacity-100"
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 5 + card.delay * 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <motion.div
          className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/[0.06]"
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: card.delay }}
        />

        <motion.div
          className="flex items-start justify-between gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: card.delay + 0.2 }}
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-blue-500/10 text-violet-300 ring-1 ring-white/10">
            <Icon className="size-4" aria-hidden />
          </div>
          <motion.div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            {isLive ? <PulseDot /> : null}
            {card.time}
          </motion.div>
        </motion.div>

        <p className="mt-3 text-sm font-semibold text-zinc-100">{card.title}</p>
        <p className="mt-0.5 text-xs text-zinc-500">{card.subtitle}</p>

        <p
          className={`mt-2 text-xs font-medium ${
            card.statusTone === 'emerald' ? 'text-emerald-400' : 'text-violet-300'
          }`}
        >
          {card.status}
        </p>

        <motion.div
          className="mt-3 h-1 overflow-hidden rounded-full bg-white/10"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: card.delay + 0.4, duration: 0.8 }}
          style={{ transformOrigin: 'left' }}
        >
          <motion.div
            className={`h-full rounded-full ${
              card.statusTone === 'emerald'
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                : 'bg-gradient-to-r from-violet-600 to-blue-500'
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${card.progress}%` }}
            transition={{ delay: card.delay + 0.5, duration: 1.2, ease: 'easeOut' }}
          />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

export function OperationalDashboard() {
  return (
    <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -inset-8 rounded-[2rem] bg-gradient-to-br from-violet-600/25 via-transparent to-blue-600/20 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.15 }}
        className="relative overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-gradient-to-br from-zinc-900/90 via-zinc-950 to-black p-5 shadow-2xl shadow-black/50 sm:p-6"
      >
        {/* Grid pattern */}
        <motion.div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(139,92,246,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.08) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
          animate={{ opacity: [0.2, 0.35, 0.2] }}
          transition={{ duration: 6, repeat: Infinity }}
        />

        <div className="relative flex items-center justify-between border-b border-white/[0.06] pb-4">
          <motion.div
            className="flex items-center gap-2"
            animate={{ opacity: [0.85, 1, 0.85] }}
            transition={{ duration: 2.5, repeat: Infinity }}
          >
            <Sparkles className="size-4 text-violet-400" aria-hidden />
            <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
              Operations live
            </span>
          </motion.div>
          <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400 ring-1 ring-emerald-500/30">
            Real-time
          </span>
        </div>

        <div className="relative mt-4 grid grid-cols-2 gap-3">
          {CARDS.map((card) => (
            <DashboardCard key={card.id} card={card} />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
