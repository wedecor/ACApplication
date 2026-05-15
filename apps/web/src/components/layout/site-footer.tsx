import Link from 'next/link';
import { Facebook, Instagram, Mail, Phone, Youtube } from 'lucide-react';

import { CITIES } from '@/content/cities';
import { SERVICES } from '@/content/services';
import { siteConfig } from '@/env';

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-muted/40">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              {siteConfig.shortName.slice(0, 2)}
            </span>
            <span>{siteConfig.name}</span>
          </Link>
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            Same-day home appliance repair from background-verified technicians. 30-day service
            warranty on every job.
          </p>
          <div className="mt-4 flex flex-col gap-2 text-sm">
            <a
              href={`tel:${siteConfig.supportPhone}`}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <Phone className="size-4" aria-hidden /> {siteConfig.supportPhone}
            </a>
            <a
              href={`mailto:${siteConfig.supportEmail}`}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <Mail className="size-4" aria-hidden /> {siteConfig.supportEmail}
            </a>
          </div>
          <div className="mt-4 flex items-center gap-3">
            {siteConfig.social.facebook ? (
              <a
                href={siteConfig.social.facebook}
                aria-label="Facebook"
                className="text-muted-foreground hover:text-foreground"
              >
                <Facebook className="size-4" />
              </a>
            ) : null}
            {siteConfig.social.instagram ? (
              <a
                href={siteConfig.social.instagram}
                aria-label="Instagram"
                className="text-muted-foreground hover:text-foreground"
              >
                <Instagram className="size-4" />
              </a>
            ) : null}
            {siteConfig.social.youtube ? (
              <a
                href={siteConfig.social.youtube}
                aria-label="YouTube"
                className="text-muted-foreground hover:text-foreground"
              >
                <Youtube className="size-4" />
              </a>
            ) : null}
          </div>
        </div>

        <FooterColumn title="Services">
          {SERVICES.slice(0, 8).map((s) => (
            <FooterLink key={s.slug} href={`/services/${s.slug}`}>
              {s.name}
            </FooterLink>
          ))}
        </FooterColumn>

        <FooterColumn title="Cities">
          {CITIES.map((c) => (
            <FooterLink key={c.slug} href={`/${c.slug}`}>
              {c.name}
            </FooterLink>
          ))}
        </FooterColumn>

        <FooterColumn title="Company">
          <FooterLink href="/about">About</FooterLink>
          <FooterLink href="/pricing">Pricing</FooterLink>
          <FooterLink href="/membership">AMC Membership</FooterLink>
          <FooterLink href="/contact">Contact</FooterLink>
          <FooterLink href="/blog">Blog</FooterLink>
          <FooterLink href="/emergency">Emergency repair</FooterLink>
          <FooterLink href="/privacy">Privacy policy</FooterLink>
          <FooterLink href="/terms">Terms of service</FooterLink>
        </FooterColumn>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>
            © {new Date().getFullYear()} {siteConfig.companyLegalName}. All rights reserved.
          </span>
          <span>Made in India · ISO-grade workmanship · 24×7 support</span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
      <ul className="flex flex-col gap-2">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href as never}
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        {children}
      </Link>
    </li>
  );
}
