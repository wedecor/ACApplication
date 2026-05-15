import '@ac/ui/styles';
import './globals.css';

import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';

import { AnalyticsScripts } from '@/components/analytics/analytics-scripts';
import { ExitIntentSheet } from '@/components/layout/exit-intent-sheet';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { StickyMobileCta } from '@/components/layout/sticky-mobile-cta';
import { WhatsAppFab } from '@/components/layout/whatsapp-fab';
import { Providers } from '@/components/providers';
import { LiveChatWidget } from '@/components/support/live-chat-widget';
import { JsonLd } from '@/components/seo/json-ld';
import { siteConfig } from '@/env';
import { organizationJsonLd, websiteJsonLd } from '@/lib/seo/json-ld';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  preload: true,
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — Home Appliance Repair, Same-Day`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  formatDetection: { telephone: false },
  manifest: '/site.webmanifest',
  alternates: { canonical: siteConfig.url },
  openGraph: {
    siteName: siteConfig.name,
    locale: 'en_IN',
    type: 'website',
    images: [{ url: siteConfig.ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    site: siteConfig.social.twitter,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        {/* Pre-connect to perf-critical origins — saves ~120ms TTFB on
           cold connections. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>
          <SiteHeader />
          <main id="content" className="pb-16 sm:pb-0">
            {children}
          </main>
          <SiteFooter />
          <WhatsAppFab />
          <StickyMobileCta />
          <ExitIntentSheet />
          <LiveChatWidget />
        </Providers>
        <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />
        <AnalyticsScripts />
      </body>
    </html>
  );
}
