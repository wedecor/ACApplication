'use client';

import { MessageCircle } from 'lucide-react';
import Link from 'next/link';

import { Events, track } from '@/lib/analytics';
import { buildWhatsAppLink, WhatsAppTemplates } from '@/lib/whatsapp';
import { cn } from '@/lib/utils';

/**
 * Always-visible WhatsApp CTA. The message defaults to a generic
 * support template; callers can override with `messageOverride` for
 * contextual deep-links (city / service / brand pages).
 */
export function WhatsAppFab({
  messageOverride,
  className,
  hideOnMobile = false,
}: {
  messageOverride?: string;
  className?: string;
  hideOnMobile?: boolean;
}) {
  const href = buildWhatsAppLink({ message: messageOverride ?? WhatsAppTemplates.general() });

  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      onClick={() => track(Events.WhatsAppClick, { location: 'fab' })}
      className={cn(
        'fixed bottom-24 right-4 z-30 flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-white shadow-lg ring-1 ring-black/10 transition-transform hover:scale-105 active:scale-95 sm:bottom-6 sm:right-6',
        hideOnMobile ? 'hidden sm:flex' : '',
        className,
      )}
    >
      <MessageCircle className="size-5" aria-hidden />
      <span className="hidden text-sm font-semibold sm:inline">Chat on WhatsApp</span>
    </Link>
  );
}
