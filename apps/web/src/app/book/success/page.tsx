import type { Metadata } from 'next';
import { CheckCircle2, MessageCircle, Phone } from 'lucide-react';
import Link from 'next/link';

import { Badge, Button } from '@ac/ui';

import { siteConfig } from '@/env';
import { buildWhatsAppLink, WhatsAppTemplates } from '@/lib/whatsapp';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Booking confirmed — we will call you in 5 minutes',
  description: 'Your booking has been received. A dispatcher will call to confirm a 2-hour slot.',
  path: '/book/success',
  noindex: true,
});

interface PageProps {
  searchParams: Promise<{ code?: string }>;
}

export default async function BookingSuccessPage({ searchParams }: PageProps) {
  const { code } = await searchParams;
  const ref = code ?? 'PENDING';
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-12 text-center sm:px-6 sm:py-16">
      <div className="flex size-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="size-8" aria-hidden />
      </div>
      <h1 className="mt-4 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
        We&apos;ve got it. A dispatcher is calling you in 5 minutes.
      </h1>
      <p className="mt-3 text-base text-muted-foreground">
        Booking reference <Badge variant="muted">{ref}</Badge>. We&apos;ve also sent a WhatsApp
        message — please confirm the slot when prompted.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button asChild size="lg" variant="outline">
          <Link
            href={buildWhatsAppLink({ message: WhatsAppTemplates.bookingFollowup(ref) })}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle className="size-4" aria-hidden /> WhatsApp follow-up
          </Link>
        </Button>
        <a
          href={`tel:${siteConfig.supportPhone}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <Phone className="size-3.5" aria-hidden /> Call {siteConfig.supportPhone}
        </a>
      </div>
      <Link
        href="/"
        className="mt-8 text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to home
      </Link>
    </div>
  );
}
