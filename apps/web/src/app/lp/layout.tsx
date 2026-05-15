import type { Metadata } from 'next';

import { siteConfig } from '@/env';

/**
 * Landing-page nested layout — minimal chrome. We deliberately render
 * NO global header / footer / FAB so the ad-traffic visitor sees a
 * single, conversion-focused screen. The root layout still injects
 * `<Providers>`, `<AnalyticsScripts>` etc., and we re-render a tiny
 * branded ribbon at the top of each LP page itself.
 *
 * SEO: every LP is forced `noindex` — the same content lives on the
 * canonical `/[city]/[service]` page for organic ranking.
 */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
  other: {
    'application-name': siteConfig.name,
  },
};

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-background">{children}</div>;
}
