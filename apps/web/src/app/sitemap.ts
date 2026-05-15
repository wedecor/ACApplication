import type { MetadataRoute } from 'next';

import { getAllPostSlugs } from '@/content/blog';
import { BRANDS } from '@/content/brands';
import { CITIES, getAllCityAreaSlugs } from '@/content/cities';
import { LANDING_PAGES } from '@/content/landing-pages';
import { SERVICES } from '@/content/services';
import { siteConfig } from '@/env';

/**
 * Programmatic sitemap.
 *
 * Includes every public route: homepage, services, brands, cities,
 * city × service matrix, areas, blog posts, static pages.
 *
 * Excluded: `/lp/*` landing pages (noindex), `/api/*` route handlers,
 * `/book/success` (transactional, noindex).
 *
 * `changeFrequency` and `priority` are *hints* — Google generally
 * ignores them but Bing / Yandex respect them.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url.replace(/\/$/, '');
  const now = new Date();
  const blogSlugs = await getAllPostSlugs();

  const staticPages: MetadataRoute.Sitemap = [
    '/',
    '/services',
    '/pricing',
    '/membership',
    '/emergency',
    '/about',
    '/contact',
    '/reviews',
    '/blog',
    '/brands',
    '/book',
  ].map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: path === '/' ? 1 : 0.8,
  }));

  const services: MetadataRoute.Sitemap = SERVICES.map((s) => ({
    url: `${base}/services/${s.slug}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.9,
  }));

  const brands: MetadataRoute.Sitemap = BRANDS.flatMap((b) => {
    const brandIndex = {
      url: `${base}/brands/${b.slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    };
    const brandServices = b.services
      .map((cat) => SERVICES.find((s) => s.category === cat))
      .filter((s): s is (typeof SERVICES)[number] => Boolean(s))
      .map((s) => ({
        url: `${base}/brands/${b.slug}/${s.slug}`,
        lastModified: now,
        changeFrequency: 'monthly' as const,
        priority: 0.6,
      }));
    return [brandIndex, ...brandServices];
  });

  const cities: MetadataRoute.Sitemap = CITIES.flatMap((c) => {
    const cityRoot = {
      url: `${base}/${c.slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    };
    const cityServices = SERVICES.map((s) => ({
      url: `${base}/${c.slug}/${s.slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));
    return [cityRoot, ...cityServices];
  });

  const areas: MetadataRoute.Sitemap = getAllCityAreaSlugs().map(({ areaSlug }) => ({
    url: `${base}/areas/${areaSlug}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.5,
  }));

  const blog: MetadataRoute.Sitemap = blogSlugs.map((slug) => ({
    url: `${base}/blog/${slug}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.5,
  }));

  // Landing pages are intentionally EXCLUDED — noindex paid surfaces.
  void LANDING_PAGES;

  return [...staticPages, ...services, ...brands, ...cities, ...areas, ...blog];
}
