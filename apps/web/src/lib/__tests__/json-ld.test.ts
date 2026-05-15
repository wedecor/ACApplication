import { describe, expect, it } from 'vitest';

import {
  articleJsonLd,
  breadcrumbsJsonLd,
  faqJsonLd,
  localBusinessJsonLd,
  organizationJsonLd,
  reviewJsonLd,
  serviceJsonLd,
  websiteJsonLd,
} from '@/lib/seo/json-ld';
import { CITIES } from '@/content/cities';
import { REVIEWS } from '@/content/reviews';
import { SERVICES } from '@/content/services';

type Any = Record<string, unknown>;

describe('JSON-LD generators', () => {
  it('Organization is shaped correctly', () => {
    const org = organizationJsonLd() as unknown as Any;
    expect(org['@context']).toBe('https://schema.org');
    expect(org['@type']).toBe('Organization');
    expect(org.name).toBeDefined();
    expect(org.contactPoint).toBeDefined();
  });

  it('WebSite includes a search potentialAction', () => {
    const site = websiteJsonLd() as unknown as Any;
    expect(site.potentialAction).toBeTruthy();
  });

  it('BreadcrumbList renders position-numbered items', () => {
    const bc = breadcrumbsJsonLd([
      { name: 'Home', url: '/' },
      { name: 'Services', url: '/services' },
    ]) as unknown as Any;
    expect(bc.itemListElement as unknown[]).toHaveLength(2);
    expect((bc.itemListElement as Any[])[1]).toMatchObject({ position: 2, name: 'Services' });
  });

  it('FAQPage emits Question entities', () => {
    const f = faqJsonLd([{ question: 'Q?', answer: 'A.' }]) as unknown as Any;
    expect(f.mainEntity as unknown[]).toHaveLength(1);
    expect((f.mainEntity as Any[])[0]).toMatchObject({
      '@type': 'Question',
      name: 'Q?',
    });
  });

  it('Service ld embeds aggregateRating when supplied', () => {
    const service = SERVICES[0]!;
    const ld = serviceJsonLd({
      service,
      url: `/services/${service.slug}`,
      aggregateRating: { rating: 4.8, count: 1000 },
    }) as unknown as Any;
    expect(ld.aggregateRating).toBeDefined();
    expect(ld.offers).toBeDefined();
  });

  it('LocalBusiness is grounded to a city', () => {
    const city = CITIES[0]!;
    const ld = localBusinessJsonLd(city) as unknown as Any;
    expect(ld['@type']).toBe('LocalBusiness');
    expect(ld.geo).toMatchObject({
      '@type': 'GeoCoordinates',
      latitude: city.latitude,
      longitude: city.longitude,
    });
  });

  it('Review carries author + rating', () => {
    const r = REVIEWS[0]!;
    const ld = reviewJsonLd(r) as unknown as Any;
    expect(ld.reviewRating).toMatchObject({ ratingValue: r.rating });
    expect(ld.author).toMatchObject({ name: r.author });
  });

  it('Article includes datePublished/dateModified', () => {
    const ld = articleJsonLd({
      title: 'Title',
      description: 'Desc',
      image: '/img.png',
      url: '/blog/foo',
      publishedAt: '2025-01-01',
      author: 'Editor',
    }) as unknown as Any;
    expect(ld.datePublished).toBe('2025-01-01');
    expect(ld.dateModified).toBe('2025-01-01');
  });
});
