import { clientIpOf, isTrustedProxyRequest } from './internal-proxy';

const TOKEN = 'x'.repeat(40);

describe('internal proxy helpers', () => {
  it('recognises only the exact token', () => {
    expect(isTrustedProxyRequest({ headers: { 'x-internal-token': TOKEN } }, TOKEN)).toBe(true);
    expect(isTrustedProxyRequest({ headers: { 'x-internal-token': 'nope' } }, TOKEN)).toBe(false);
    expect(isTrustedProxyRequest({ headers: {} }, undefined)).toBe(false);
  });

  it('uses x-client-ip only from the trusted proxy', () => {
    process.env.PUBLIC_LEAD_API_TOKEN = TOKEN;
    expect(clientIpOf({ headers: { 'x-internal-token': TOKEN, 'x-client-ip': '203.0.113.9' }, ip: '10.0.0.5' })).toBe('203.0.113.9');
    expect(clientIpOf({ headers: { 'x-client-ip': '203.0.113.9' }, ip: '10.0.0.5' })).toBe('10.0.0.5');
    delete process.env.PUBLIC_LEAD_API_TOKEN;
  });
});
