import { otp } from '@ac/auth';

describe('OTP utilities', () => {
  it('generates a 6-digit zero-padded numeric code', () => {
    const code = otp.generate({ length: 6 });
    expect(code).toMatch(/^\d{6}$/);
  });

  it('hash + verify roundtrips', () => {
    const code = '123456';
    const h = otp.hash(code, 'pepper');
    expect(otp.verify(code, h, 'pepper')).toBe(true);
    expect(otp.verify('000000', h, 'pepper')).toBe(false);
  });
});
