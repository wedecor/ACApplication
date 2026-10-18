import { describe, expect, it } from 'vitest';

import { aggregateRatingLd, EMPTY_STATS, parsePublicStats, ratingSummary } from '../public-api';

describe('parsePublicStats', () => {
  it('keeps real numbers and drops anything else', () => {
    expect(parsePublicStats({ completedRepairs: 128, customersServed: 'many', averageRating: 4.4, ratingCount: 37 })).toMatchObject({
      completedRepairs: 128,
      customersServed: null,
      averageRating: 4.4,
      ratingCount: 37,
    });
  });

  it('ignores an average with no ratings behind it', () => {
    expect(parsePublicStats({ averageRating: 4.8, ratingCount: 0 }).averageRating).toBeNull();
  });

  it('falls back to all-unknown, never to invented figures', () => {
    expect(parsePublicStats(null)).toEqual(EMPTY_STATS);
  });
});

describe('aggregate rating helpers', () => {
  const real = { ...EMPTY_STATS, averageRating: 4.4, ratingCount: 37 };

  it('emits structured-data ratings only from real counts', () => {
    expect(aggregateRatingLd(real)).toEqual({ rating: 4.4, count: 37 });
    expect(aggregateRatingLd(EMPTY_STATS)).toBeNull();
  });

  it('formats a summary line or nothing', () => {
    expect(ratingSummary(real)).toBe('4.4 / 5 · 37 reviews');
    expect(ratingSummary({ ...real, ratingCount: 1 })).toBe('4.4 / 5 · 1 review');
    expect(ratingSummary(EMPTY_STATS)).toBeNull();
  });
});
