import { describe, expect, it } from 'vitest';

import { buildMetadata, uniqKeywords } from '@/lib/seo/metadata';

describe('buildMetadata', () => {
  it('produces an absolute canonical from a relative path', () => {
    const meta = buildMetadata({
      title: 'Page',
      description: 'Description',
      path: '/services/ac-repair',
    });
    expect(meta.alternates?.canonical).toMatch(/^http.*\/services\/ac-repair$/);
  });

  it('emits OpenGraph + Twitter shapes', () => {
    const meta = buildMetadata({
      title: 'Page',
      description: 'Description',
      path: '/',
    });
    expect(meta.openGraph?.locale).toBe('en_IN');
    expect((meta.twitter as { card?: string } | undefined)?.card).toBe('summary_large_image');
    expect(meta.openGraph?.images).toBeTruthy();
  });

  it('locks down noindex pages', () => {
    const meta = buildMetadata({
      title: 'LP',
      description: 'Paid traffic only',
      path: '/lp/ac-repair-bangalore',
      noindex: true,
    });
    const robots = meta.robots as { index?: boolean; googleBot?: { index?: boolean } };
    expect(robots.index).toBe(false);
    expect(robots.googleBot?.index).toBe(false);
  });
});

describe('uniqKeywords', () => {
  it('dedupes case-insensitive while preserving order', () => {
    expect(uniqKeywords(['AC repair', 'ac repair', 'split AC'])).toEqual(['ac repair', 'split ac']);
  });

  it('handles undefined inputs', () => {
    expect(uniqKeywords(undefined, ['a', 'b'])).toEqual(['a', 'b']);
  });
});
