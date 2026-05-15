import type { Metadata } from 'next';

import { siteConfig } from '@/env';

export interface BuildMetadataInput {
  /** Page title (without site name; we template it). */
  title: string;
  /** Meta description ≤ 160 chars. */
  description: string;
  /** Page URL — absolute or app-relative. */
  path: string;
  /** Hero / OG image — absolute URL or `/public` path. */
  image?: string;
  /** Keywords list. */
  keywords?: string[];
  /** If true, page is excluded from index. Use for /lp/* + /preview/*. */
  noindex?: boolean;
  /** Override canonical URL (use when republishing). */
  canonical?: string;
  /** Optional alternate language URLs — `{ 'en-IN': '/foo' }`. */
  alternates?: Record<string, string>;
  /** ISO date of publication (article only). */
  publishedTime?: string;
  /** ISO date of last modification (article only). */
  modifiedTime?: string;
  /** Author name (article only). */
  authors?: string[];
  /** Article tags. */
  tags?: string[];
  /** Page type — `website` (default) or `article`. */
  type?: 'website' | 'article';
}

/**
 * Single-source metadata builder. Every public page goes through here so
 * we ship consistent canonicals, OG tags, Twitter cards, and robots
 * directives.
 *
 * Rules:
 *  - Canonical is required and absolute. Next.js' `metadataBase` is set
 *    in the root layout, so we use it for relative-to-absolute joins.
 *  - `og:type=website` for every page except blog posts (`article`).
 *  - Landing pages MUST set `noindex: true` — they cannibalise organic.
 */
export function buildMetadata(input: BuildMetadataInput): Metadata {
  const baseUrl = new URL(siteConfig.url);
  const path = input.path.startsWith('http') ? input.path : input.path;
  const fullUrl = input.canonical ?? new URL(path, baseUrl).toString();
  const image = resolveImage(input.image ?? siteConfig.ogImage);

  return {
    metadataBase: baseUrl,
    title: input.title,
    description: input.description,
    keywords: input.keywords,
    alternates: {
      canonical: fullUrl,
      languages: input.alternates,
    },
    openGraph: {
      type: input.type ?? 'website',
      url: fullUrl,
      siteName: siteConfig.name,
      title: input.title,
      description: input.description,
      locale: 'en_IN',
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: input.title,
        },
      ],
      ...(input.publishedTime ? { publishedTime: input.publishedTime } : {}),
      ...(input.modifiedTime ? { modifiedTime: input.modifiedTime } : {}),
      ...(input.authors?.length ? { authors: input.authors } : {}),
      ...(input.tags?.length ? { tags: input.tags } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      site: siteConfig.social.twitter,
      title: input.title,
      description: input.description,
      images: [image],
    },
    robots: input.noindex
      ? {
          index: false,
          follow: false,
          nocache: true,
          googleBot: { index: false, follow: false, noimageindex: true },
        }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            'max-image-preview': 'large',
            'max-snippet': -1,
            'max-video-preview': -1,
          },
        },
    icons: {
      icon: '/favicon.ico',
      apple: '/apple-touch-icon.png',
    },
  };
}

function resolveImage(image: string): string {
  if (image.startsWith('http')) return image;
  return new URL(image, siteConfig.url).toString();
}

/** Helper to deduplicate keyword arrays while preserving order. */
export function uniqKeywords(...lists: Array<string[] | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    if (!list) continue;
    for (const k of list) {
      const key = k.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(key);
    }
  }
  return out;
}
