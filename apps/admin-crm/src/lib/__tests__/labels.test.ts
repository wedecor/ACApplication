import { describe, expect, it } from 'vitest';

import { categoryLabel, humanizeEnum, leadSourceLabel } from '../labels';

describe('labels', () => {
  it('keeps acronyms and brand casing for curated values', () => {
    expect(categoryLabel('AC_REPAIR')).toBe('AC repair');
    expect(leadSourceLabel('WHATSAPP')).toBe('WhatsApp');
    expect(leadSourceLabel('GOOGLE_ADS')).toBe('Google Ads');
  });

  it('falls back to sentence case for unknown values', () => {
    expect(humanizeEnum('WAITING_PARTS')).toBe('Waiting parts');
    expect(categoryLabel('NEW_THING')).toBe('New thing');
  });

  it('renders a dash for empty values', () => {
    expect(humanizeEnum(null)).toBe('—');
    expect(categoryLabel(undefined)).toBe('—');
  });
});
