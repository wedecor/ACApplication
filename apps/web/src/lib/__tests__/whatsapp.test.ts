import { describe, expect, it } from 'vitest';

import { buildWhatsAppLink, WhatsAppTemplates } from '@/lib/whatsapp';

describe('buildWhatsAppLink', () => {
  it('strips non-digits from the phone number', () => {
    const url = buildWhatsAppLink({ number: '+91 (999) 999-9999', message: 'Hi' });
    expect(url).toMatch(/wa\.me\/919999999999/);
  });

  it('URL-encodes the message', () => {
    const url = buildWhatsAppLink({ message: 'Hello world & friends' });
    expect(url).toMatch(/text=Hello%20world%20%26%20friends/);
  });
});

describe('WhatsAppTemplates', () => {
  it('service template name-drops the service', () => {
    const text = WhatsAppTemplates.service({ name: 'AC Repair' });
    expect(text).toContain('AC Repair');
  });

  it('booking follow-up references the code', () => {
    expect(WhatsAppTemplates.bookingFollowup('LEAD-001')).toContain('LEAD-001');
  });
});
