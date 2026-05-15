'use client';

import Link from 'next/link';
import { CalendarDays, MessageCircle, Phone } from 'lucide-react';
import { motion } from 'framer-motion';

import { siteConfig } from '@/env';
import { Events, track } from '@/lib/analytics';
import { buildWhatsAppLink, WhatsAppTemplates } from '@/lib/whatsapp';

/**
 * Premium mobile sticky bar — thumb-friendly, WhatsApp-first.
 */
export function StickyMobileCta() {
  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ delay: 0.8, type: 'spring', stiffness: 260, damping: 28 }}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-zinc-950/95 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:hidden"
    >
      <motion.div
        className="mx-auto flex max-w-lg gap-2"
        whileTap={{ scale: 0.99 }}
      >
        <a
          href={`tel:${siteConfig.supportPhone}`}
          className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 text-sm font-medium text-zinc-200"
          onClick={() => track(Events.CallClick, { location: 'sticky-mobile' })}
        >
          <Phone className="size-4" aria-hidden />
          Call
        </a>
        <Link
          href={buildWhatsAppLink({ message: WhatsAppTemplates.general() })}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-sm font-semibold text-emerald-300"
          onClick={() => track(Events.WhatsAppClick, { location: 'sticky-mobile' })}
        >
          <MessageCircle className="size-4" aria-hidden />
          WhatsApp
        </Link>
        <Link
          href="/book"
          className="flex min-h-[48px] flex-[1.35] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-sm font-semibold text-white shadow-lg shadow-violet-600/30"
          onClick={() => track(Events.CtaClick, { location: 'sticky-mobile', label: 'book' })}
        >
          <CalendarDays className="size-4" aria-hidden />
          Book now
        </Link>
      </motion.div>
    </motion.div>
  );
}
