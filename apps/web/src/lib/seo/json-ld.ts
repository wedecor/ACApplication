/**
 * JSON-LD generators.
 *
 * Each function returns a typed `WithContext<…>` schema-dts object that
 * can be passed straight to a `<JsonLd>` component for safe rendering.
 *
 * Why one file?
 *   • Centralises every structured-data shape we ship so it's easy to
 *     audit (`view-source: → ld+json blocks`).
 *   • Keeps schema-dts as a dev-only dependency for type safety, but
 *     allows callers to ignore the typing if they need to.
 */

import type {
  Article,
  BreadcrumbList,
  FAQPage,
  LocalBusiness,
  Organization,
  Product,
  Review,
  Service,
  WebSite,
  WithContext,
} from 'schema-dts';

import { siteConfig } from '@/env';
import type { City } from '@/content/cities';
import type { CustomerReview } from '@/content/reviews';
import type { Service as ServiceContent } from '@/content/services';

const ORG_ID = `${siteConfig.url}#org`;

export function organizationJsonLd(): WithContext<Organization> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORG_ID,
    name: siteConfig.companyLegalName,
    url: siteConfig.url,
    logo: new URL('/logo.png', siteConfig.url).toString(),
    foundingDate: String(siteConfig.companyFoundedYear),
    sameAs: [
      siteConfig.social.facebook,
      siteConfig.social.instagram,
      siteConfig.social.youtube,
    ].filter(Boolean) as string[],
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        telephone: siteConfig.supportPhone,
        email: siteConfig.supportEmail,
        availableLanguage: ['en', 'hi', 'kn', 'ta', 'te', 'mr'],
        areaServed: 'IN',
      },
    ],
  };
}

export function websiteJsonLd(): WithContext<WebSite> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteConfig.name,
    url: siteConfig.url,
    publisher: { '@id': ORG_ID },
    potentialAction: {
      '@type': 'SearchAction',
      target: `${siteConfig.url}/search?q={search_term_string}`,
      // schema-dts requires a primitive string here; the spec accepts
      // the magic placeholder.
      'query-input': 'required name=search_term_string',
    } as unknown as WithContext<WebSite>['potentialAction'],
  };
}

export function breadcrumbsJsonLd(
  items: Array<{ name: string; url: string }>,
): WithContext<BreadcrumbList> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : new URL(item.url, siteConfig.url).toString(),
    })),
  };
}

export function faqJsonLd(
  faqs: Array<{ question: string; answer: string }>,
): WithContext<FAQPage> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}

export function serviceJsonLd(input: {
  service: ServiceContent;
  city?: City | null;
  url: string;
  aggregateRating?: { rating: number; count: number };
}): WithContext<Service> {
  const { service, city, url } = input;
  const areaServed = city
    ? { '@type': 'City' as const, name: city.name }
    : { '@type': 'Country' as const, name: 'India' };

  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: city ? `${service.name} in ${city.name}` : service.name,
    description: service.description,
    serviceType: service.name,
    provider: { '@id': ORG_ID },
    areaServed,
    url: new URL(url, siteConfig.url).toString(),
    ...(input.aggregateRating
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: input.aggregateRating.rating,
            reviewCount: input.aggregateRating.count,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    offers: service.pricing.map((p) => ({
      '@type': 'Offer',
      name: p.label,
      description: p.description,
      priceCurrency: 'INR',
      price: extractPrice(p.price),
    })) as unknown as Service['offers'],
  };
}

export function localBusinessJsonLd(city: City): WithContext<LocalBusiness> {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${siteConfig.url}/${city.slug}#local`,
    name: `${siteConfig.name} — ${city.name}`,
    description: `Home appliance repair, installation and AMC services in ${city.name}.`,
    url: new URL(`/${city.slug}`, siteConfig.url).toString(),
    telephone: siteConfig.supportPhone,
    image: new URL('/og.png', siteConfig.url).toString(),
    priceRange: '₹₹',
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'IN',
      addressLocality: city.name,
      addressRegion: city.state,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: city.latitude,
      longitude: city.longitude,
    },
    areaServed: city.areas.map((a) => ({
      '@type': 'Place',
      name: a.name,
    })),
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: city.rating,
      reviewCount: city.reviewCount,
      bestRating: 5,
      worstRating: 1,
    },
    parentOrganization: { '@id': ORG_ID },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: [
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
          'Sunday',
        ],
        opens: '07:00',
        closes: '22:00',
      },
    ],
  };
}

export function reviewJsonLd(review: CustomerReview): WithContext<Review> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Review',
    reviewBody: review.body,
    name: review.title,
    datePublished: review.publishedAt,
    reviewRating: {
      '@type': 'Rating',
      ratingValue: review.rating,
      bestRating: 5,
      worstRating: 1,
    },
    author: { '@type': 'Person', name: review.author },
    itemReviewed: { '@id': ORG_ID },
  };
}

export function productJsonLd(input: {
  name: string;
  description: string;
  image: string;
  url: string;
  aggregateRating: { rating: number; count: number };
  offers: Array<{ price: number; name: string }>;
}): WithContext<Product> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.name,
    description: input.description,
    image: input.image,
    url: new URL(input.url, siteConfig.url).toString(),
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: input.aggregateRating.rating,
      reviewCount: input.aggregateRating.count,
      bestRating: 5,
      worstRating: 1,
    },
    offers: input.offers.map((o) => ({
      '@type': 'Offer',
      name: o.name,
      priceCurrency: 'INR',
      price: o.price,
      availability: 'https://schema.org/InStock',
    })),
  };
}

export function articleJsonLd(input: {
  title: string;
  description: string;
  image: string;
  url: string;
  publishedAt: string;
  updatedAt?: string;
  author: string;
}): WithContext<Article> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.title,
    description: input.description,
    image: input.image,
    mainEntityOfPage: { '@type': 'WebPage', '@id': new URL(input.url, siteConfig.url).toString() },
    datePublished: input.publishedAt,
    dateModified: input.updatedAt ?? input.publishedAt,
    author: { '@type': 'Person', name: input.author },
    publisher: { '@id': ORG_ID },
  };
}

/**
 * Extract a numeric INR price from a display string ("₹699", "From ₹2,499").
 * Returns 0 if no number is found — callers can choose to omit Offer in
 * that case.
 */
function extractPrice(display: string): number {
  const match = display.match(/[\d,]+/);
  if (!match) return 0;
  return Number(match[0].replace(/,/g, ''));
}
