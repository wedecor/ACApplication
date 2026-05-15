import type { MetadataRoute } from 'next';

import { siteConfig } from '@/env';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/lp/', '/book/success', '/_next/'],
      },
      {
        userAgent: 'GPTBot',
        disallow: ['/'],
      },
      {
        userAgent: 'CCBot',
        disallow: ['/'],
      },
    ],
    sitemap: `${siteConfig.url.replace(/\/$/, '')}/sitemap.xml`,
    host: siteConfig.url,
  };
}
