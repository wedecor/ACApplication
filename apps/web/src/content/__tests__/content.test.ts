import { describe, expect, it } from 'vitest';

import { SERVICES, getAllServiceSlugs, getServiceBySlug, getServiceByCategory } from '@/content/services';
import { CITIES, getCityBySlug, getLiveCities, getAllCityAreaSlugs, findAreaAnywhere } from '@/content/cities';
import { BRANDS, getBrandBySlug, getAllBrandSlugs } from '@/content/brands';
import { aggregateRating, getReviewsFor, REVIEWS } from '@/content/reviews';
import { getAllLandingSlugs, getLandingBySlug } from '@/content/landing-pages';

describe('content/services', () => {
  it('exposes the expected canonical services', () => {
    expect(getAllServiceSlugs()).toEqual(
      expect.arrayContaining([
        'ac-repair',
        'ac-installation',
        'ac-servicing',
        'washing-machine-repair',
        'refrigerator-repair',
        'microwave-repair',
        'geyser-repair',
        'chimney-cleaning',
      ]),
    );
  });

  it('every service has SEO fields filled in', () => {
    for (const s of SERVICES) {
      expect(s.heading.length).toBeGreaterThan(10);
      expect(s.description.length).toBeGreaterThan(30);
      expect(s.description.length).toBeLessThanOrEqual(220);
      expect(s.pricing.length).toBeGreaterThan(0);
      expect(s.faqs.length).toBeGreaterThan(0);
    }
  });

  it('getServiceBySlug returns the right service', () => {
    expect(getServiceBySlug('ac-repair')?.category).toBe('AC_REPAIR');
    expect(getServiceBySlug('does-not-exist')).toBeNull();
  });

  it('getServiceByCategory mirrors getServiceBySlug', () => {
    const byCategory = getServiceByCategory('AC_REPAIR');
    expect(byCategory?.slug).toBe('ac-repair');
  });
});

describe('content/cities', () => {
  it('exposes at least 3 live cities', () => {
    expect(getLiveCities().length).toBeGreaterThanOrEqual(3);
  });

  it('every city has at least 3 areas', () => {
    for (const c of CITIES) {
      expect(c.areas.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('area slugs are unique across cities', () => {
    const all = getAllCityAreaSlugs().map((a) => a.areaSlug);
    expect(new Set(all).size).toBe(all.length);
  });

  it('findAreaAnywhere resolves by area slug', () => {
    const r = findAreaAnywhere('whitefield');
    expect(r?.city.slug).toBe('bengaluru');
  });

  it('getCityBySlug returns the right entry', () => {
    expect(getCityBySlug('bengaluru')?.name).toBe('Bengaluru');
    expect(getCityBySlug('nope')).toBeNull();
  });
});

describe('content/brands', () => {
  it('exposes a sane number of brands', () => {
    expect(getAllBrandSlugs().length).toBeGreaterThanOrEqual(10);
  });

  it('every brand declares at least one service category', () => {
    for (const b of BRANDS) {
      expect(b.services.length).toBeGreaterThan(0);
    }
  });

  it('getBrandBySlug works', () => {
    expect(getBrandBySlug('lg')?.name).toBe('LG');
  });
});

describe('content/reviews', () => {
  it('aggregateRating returns a 1-decimal value between 1 and 5', () => {
    const r = aggregateRating();
    expect(r.rating).toBeGreaterThanOrEqual(1);
    expect(r.rating).toBeLessThanOrEqual(5);
    expect(r.count).toBe(REVIEWS.length);
  });

  it('getReviewsFor narrows by service slug', () => {
    const r = getReviewsFor({ serviceSlug: 'ac-repair' });
    for (const review of r) {
      expect(review.serviceSlug).toBe('ac-repair');
    }
  });
});

describe('content/landing-pages', () => {
  it('every LP has noindex-safe SEO copy', () => {
    for (const slug of getAllLandingSlugs()) {
      const lp = getLandingBySlug(slug);
      expect(lp).toBeTruthy();
      expect(lp!.seo.title.length).toBeGreaterThan(15);
      expect(lp!.seo.description.length).toBeGreaterThan(30);
      expect(lp!.pricingHighlights.length).toBeGreaterThan(0);
    }
  });
});
