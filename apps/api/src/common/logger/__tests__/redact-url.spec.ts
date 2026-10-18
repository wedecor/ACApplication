import { redactUrl } from '../redact-url';

describe('redactUrl', () => {
  it('hides tokens in public paths and signed query params', () => {
    expect(redactUrl('/api/v1/quotations/public/abc123/approve')).toBe('/api/v1/quotations/public/[REDACTED]/approve');
    expect(redactUrl('/api/v1/public/ratings/x.y')).toBe('/api/v1/public/ratings/[REDACTED]');
    expect(redactUrl('/api/v1/me/invoices/i1/pdf?sig=deadbeef&exp=1')).toBe('/api/v1/me/invoices/i1/pdf?sig=[REDACTED]&exp=1');
  });

  it('leaves ordinary URLs alone', () => {
    expect(redactUrl('/api/v1/bookings?page=2')).toBe('/api/v1/bookings?page=2');
  });
});
