import Link from 'next/link';

import { Button } from '@ac/ui';

import { buildWhatsAppLink, WhatsAppTemplates } from '@/lib/whatsapp';

/**
 * Reusable bottom-of-page CTA strip. Customise via props so the same
 * component drops onto homepage, service page, city page and blog post.
 */
export function CtaBand({
  title = 'Book a technician in 60 seconds.',
  description = '30-day service warranty, transparent quotes on WhatsApp, pay only after the job.',
  primaryHref = '/book',
  primaryLabel = 'Book a service',
  whatsappMessage = WhatsAppTemplates.general(),
}: {
  title?: string;
  description?: string;
  primaryHref?: string;
  primaryLabel?: string;
  whatsappMessage?: string;
}) {
  return (
    <section className="bg-gradient-to-br from-primary to-primary/80 py-16 text-primary-foreground">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 text-center sm:px-6">
        <h2 className="max-w-3xl text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          {title}
        </h2>
        <p className="max-w-2xl text-balance text-base opacity-90 sm:text-lg">{description}</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="xl" variant="secondary">
            <Link href={primaryHref as never}>{primaryLabel}</Link>
          </Button>
          <Button asChild size="xl" variant="outline" className="border-white/30 bg-transparent text-primary-foreground hover:bg-white/10">
            <Link
              href={buildWhatsAppLink({ message: whatsappMessage })}
              target="_blank"
              rel="noopener noreferrer"
            >
              Chat on WhatsApp
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
