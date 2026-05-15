'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Phone, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@ac/ui';

import { siteConfig } from '@/env';
import { Events, track } from '@/lib/analytics';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { href: '/services', label: 'Services' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/membership', label: 'AMC' },
  { href: '/about', label: 'About' },
  { href: '/blog', label: 'Blog' },
  { href: '/contact', label: 'Contact' },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 w-full transition-all',
        scrolled
          ? 'bg-background/85 backdrop-blur-md shadow-sm border-b border-border'
          : 'bg-background',
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              {siteConfig.shortName.slice(0, 2)}
            </span>
            <span className="text-base">{siteConfig.name}</span>
          </Link>
          <nav className="hidden items-center gap-6 md:flex" aria-label="Primary">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href as never}
                className={cn(
                  'text-sm font-medium transition-colors hover:text-primary',
                  pathname?.startsWith(link.href)
                    ? 'text-foreground'
                    : 'text-muted-foreground',
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`tel:${siteConfig.supportPhone}`}
            className="hidden items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground md:inline-flex"
            onClick={() => track(Events.CallClick, { location: 'header' })}
          >
            <Phone className="size-3.5" aria-hidden /> {siteConfig.supportPhone}
          </a>
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link
              href="/book"
              onClick={() => track(Events.CtaClick, { location: 'header', label: 'book' })}
            >
              Book a service
            </Link>
          </Button>
          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-md text-foreground md:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-border bg-background md:hidden" id="mobile-menu">
          <nav className="flex flex-col gap-1 p-4" aria-label="Mobile">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href as never}
                className="rounded-md px-3 py-2 text-base font-medium hover:bg-accent"
              >
                {link.label}
              </Link>
            ))}
            <Button asChild fullWidth size="lg" className="mt-2">
              <Link
                href="/book"
                onClick={() => track(Events.CtaClick, { location: 'mobile-menu', label: 'book' })}
              >
                Book a service
              </Link>
            </Button>
            <a
              href={`tel:${siteConfig.supportPhone}`}
              className="flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium"
              onClick={() => track(Events.CallClick, { location: 'mobile-menu' })}
            >
              <Phone className="size-4" aria-hidden /> Call {siteConfig.supportPhone}
            </a>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
