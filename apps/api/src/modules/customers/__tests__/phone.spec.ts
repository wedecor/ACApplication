import { normalizePhoneE164, phoneVariants } from '../phone';

describe('normalizePhoneE164', () => {
  it.each([
    ['9876543210', '+919876543210'],
    ['98765 43210', '+919876543210'],
    ['098765-43210', '+919876543210'],
    ['919876543210', '+919876543210'],
    ['+91 98765 43210', '+919876543210'],
    ['0091 9876543210', '+919876543210'],
    ['+1 (415) 555-2671', '+14155552671'],
  ])('normalises %s → %s', (input, expected) => {
    expect(normalizePhoneE164(input)).toBe(expected);
  });

  it.each(['', '12345', '5876543210', 'abc9876543210', '+91123', '+0123456789', null, undefined])(
    'rejects %p',
    (input) => {
      expect(normalizePhoneE164(input)).toBeNull();
    },
  );

  it('accepts numeric input', () => {
    expect(normalizePhoneE164(9876543210)).toBe('+919876543210');
  });

  it('honours a non-Indian default country code', () => {
    expect(normalizePhoneE164('07911123456', '44')).toBe('+447911123456');
  });
});

describe('phoneVariants', () => {
  it('lists legacy spellings for Indian numbers', () => {
    expect(phoneVariants('+919876543210').sort()).toEqual(
      ['+919876543210', '09876543210', '919876543210', '9876543210'].sort(),
    );
  });
});
