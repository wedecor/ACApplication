import { parseTrustProxy } from '../trust-proxy';

describe('parseTrustProxy', () => {
  it('uses the socket address by default', () => {
    expect(parseTrustProxy(undefined)).toBe(false);
    expect(parseTrustProxy('false')).toBe(false);
  });

  it('accepts a hop count or a proxy list', () => {
    expect(parseTrustProxy('1')).toBe(1);
    expect(parseTrustProxy(' 10.0.0.0/8, 172.16.0.1 ')).toBe('10.0.0.0/8,172.16.0.1');
  });

  it('refuses to trust every proxy', () => {
    expect(() => parseTrustProxy('true')).toThrow(/unsafe/);
  });
});
