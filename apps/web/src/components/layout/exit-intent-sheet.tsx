'use client';

import { Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Button } from '@ac/ui';

import { Events, track } from '@/lib/analytics';
import { buildWhatsAppLink, WhatsAppTemplates } from '@/lib/whatsapp';

const STORAGE_KEY = 'ac:exit-intent:dismissed';

/**
 * Desktop-only exit-intent sheet. Shows once per session when the
 * mouse leaves the top of the viewport (signal of a tab-close). Stores
 * a `sessionStorage` flag so it never nags twice per visit.
 *
 * We deliberately avoid showing this on mobile — mobile cursor-leave
 * doesn't exist and the StickyMobileCTA covers that surface.
 */
export function ExitIntentSheet() {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      setSeen(Boolean(sessionStorage.getItem(STORAGE_KEY)));
    } catch {
      setSeen(false);
    }
  }, []);

  useEffect(() => {
    if (seen) return;
    if (typeof window === 'undefined') return;
    if (window.innerWidth < 1024) return;

    const onMouseOut = (e: MouseEvent) => {
      if (e.relatedTarget) return;
      if (e.clientY > 0) return;
      setOpen(true);
      try {
        sessionStorage.setItem(STORAGE_KEY, '1');
      } catch {}
      track(Events.ExitIntentShown);
      document.removeEventListener('mouseout', onMouseOut);
    };

    const timer = window.setTimeout(() => {
      document.addEventListener('mouseout', onMouseOut);
    }, 5_000);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('mouseout', onMouseOut);
    };
  }, [seen]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="exit-intent-title"
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
    >
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      <div className="relative w-full max-w-md rounded-2xl bg-background p-6 shadow-2xl ring-1 ring-border">
        <button
          type="button"
          aria-label="Close"
          className="absolute right-4 top-4 inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={() => setOpen(false)}
        >
          <X className="size-4" />
        </button>
        <Sparkles className="size-5 text-primary" aria-hidden />
        <h2 id="exit-intent-title" className="mt-2 text-xl font-bold">
          Wait — get 10% off your first repair
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Book in the next 10 minutes and we'll send a verified technician with a transparent
          quote on WhatsApp before any work starts.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Button asChild size="lg">
            <Link
              href="/book?utm_source=exit_intent"
              onClick={() => {
                track(Events.ExitIntentConverted, { method: 'book' });
                setOpen(false);
              }}
            >
              Book now & save 10%
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link
              href={buildWhatsAppLink({ message: WhatsAppTemplates.general() })}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                track(Events.ExitIntentConverted, { method: 'whatsapp' });
                setOpen(false);
              }}
            >
              Or chat on WhatsApp
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
