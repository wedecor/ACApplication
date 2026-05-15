import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, MessageCircle, Phone } from 'lucide-react';

import { Badge, Button } from '@ac/ui';

import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { Testimonials } from '@/components/home/testimonials';
import { TrustStrip } from '@/components/home/trust-strip';
import { CtaBand } from '@/components/sections/cta-band';
import { Faq } from '@/components/sections/faq';
import { SITE_FAQS } from '@/content/faqs';
import { siteConfig } from '@/env';
import { buildMetadata } from '@/lib/seo/metadata';
import { buildWhatsAppLink, WhatsAppTemplates } from '@/lib/whatsapp';

export const metadata: Metadata = buildMetadata({
  title: 'Emergency Appliance Repair — 60-Minute Response, 24×7',
  description:
    'AC, fridge, geyser or washing machine emergency? Verified technicians dispatched in 60 minutes. 24×7 in serviceable cities.',
  path: '/emergency',
  keywords: ['emergency ac repair', 'emergency appliance repair', '24x7 appliance service', 'urgent fridge repair'],
});

export default function EmergencyPage() {
  return (
    <>
      <Breadcrumbs items={[{ name: 'Home', href: '/' }, { name: 'Emergency', href: '/emergency' }]} />
      <header className="border-b border-border bg-gradient-to-br from-rose-500/10 via-background to-amber-500/10">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
          <Badge variant="muted" className="gap-1.5">
            <AlertTriangle className="size-3.5 text-amber-500" aria-hidden /> Emergency dispatch
          </Badge>
          <h1 className="mt-3 text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            Technician at your door in 60 minutes.
          </h1>
          <p className="mt-3 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
            For AC, fridge, geyser or washing-machine emergencies — call our 24×7 emergency line
            or tap the button below. A dispatcher will confirm in under 5 minutes.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="xl">
              <Link href="/book?urgency=emergency">
                Send a technician now
              </Link>
            </Button>
            <Button asChild size="xl" variant="outline">
              <a href={`tel:${siteConfig.supportPhone}`}>
                <Phone className="size-4" aria-hidden /> Call {siteConfig.supportPhone}
              </a>
            </Button>
            <Button asChild size="xl" variant="ghost">
              <Link
                href={buildWhatsAppLink({ message: WhatsAppTemplates.emergency() })}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="size-4" aria-hidden /> WhatsApp dispatcher
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <TrustStrip />
      <Testimonials title="Customers we've helped under pressure" />
      <Faq items={SITE_FAQS} />
      <CtaBand title="Emergency? We're standing by." />
    </>
  );
}
