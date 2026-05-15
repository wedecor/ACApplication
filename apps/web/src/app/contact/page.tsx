import type { Metadata } from 'next';
import { Mail, MapPin, MessageCircle, Phone } from 'lucide-react';

import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { CtaBand } from '@/components/sections/cta-band';
import { siteConfig } from '@/env';
import { buildMetadata } from '@/lib/seo/metadata';
import { buildWhatsAppLink, WhatsAppTemplates } from '@/lib/whatsapp';

export const metadata: Metadata = buildMetadata({
  title: 'Contact Us',
  description: `Reach the ${siteConfig.name} team — phone, WhatsApp, email, and head office details.`,
  path: '/contact',
});

export default function ContactPage() {
  return (
    <>
      <Breadcrumbs items={[{ name: 'Home', href: '/' }, { name: 'Contact', href: '/contact' }]} />
      <header className="border-b border-border bg-muted/20">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            We&apos;re here, all 7 days.
          </h1>
          <p className="mt-3 max-w-2xl text-base text-muted-foreground">
            For bookings, follow-ups and AMC support — call, WhatsApp or email us.
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <ContactCard
            icon={<Phone className="size-5" aria-hidden />}
            title="Call us"
            line={siteConfig.supportPhone}
            href={`tel:${siteConfig.supportPhone}`}
            sub="Mon–Sun · 7 AM – 10 PM"
          />
          <ContactCard
            icon={<MessageCircle className="size-5" aria-hidden />}
            title="WhatsApp"
            line="Chat with a dispatcher"
            href={buildWhatsAppLink({ message: WhatsAppTemplates.general() })}
            sub="Responds in 2 minutes (median)"
          />
          <ContactCard
            icon={<Mail className="size-5" aria-hidden />}
            title="Email"
            line={siteConfig.supportEmail}
            href={`mailto:${siteConfig.supportEmail}`}
            sub="Same-day response"
          />
        </div>

        <div className="mt-10 rounded-2xl border border-border bg-card p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <MapPin className="size-4 text-primary" aria-hidden /> Head office
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {siteConfig.companyLegalName}
            <br />
            Tower B, Brigade Tech Gardens, Whitefield
            <br />
            Bengaluru 560066, Karnataka, India
          </p>
        </div>
      </section>

      <CtaBand />
    </>
  );
}

function ContactCard({
  icon,
  title,
  line,
  sub,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  line: string;
  sub: string;
  href: string;
}) {
  return (
    <a
      href={href}
      target={href.startsWith('https') ? '_blank' : undefined}
      rel="noopener noreferrer"
      className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
    >
      <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="mt-3 text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-base font-bold">{line}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </a>
  );
}
