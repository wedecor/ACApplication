import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('../api', () => ({ api: vi.fn() }));
vi.mock('../auth', () => ({ getOrCreateDeviceId: vi.fn(), setAuthSession: vi.fn() }));

const { toE164 } = await import('../session-api');

describe('toE164', () => {
  it('prefixes a 10-digit Indian mobile with +91', () => {
    expect(toE164('98765 43210')).toBe('+919876543210');
    expect(toE164('098765-43210')).toBe('+919876543210');
  });

  it('keeps numbers that are already E.164', () => {
    expect(toE164('+919876543210')).toBe('+919876543210');
  });

  it('rejects numbers that are not valid mobiles', () => {
    expect(toE164('12345')).toBeNull();
    expect(toE164('5876543210')).toBeNull();
  });
});
