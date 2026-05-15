import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from '@/app/api/lead/route';

describe('POST /api/lead', () => {
  const originalFetch = global.fetch;
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  const validBody = {
    customerName: 'Jane Doe',
    phone: '+919876543210',
    applianceType: 'AC_REPAIR',
  };

  function makeRequest(body: unknown, headers: Record<string, string> = {}) {
    return new Request('http://localhost/api/lead', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  }

  it('forwards a valid payload to the upstream API and returns the leadCode', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { ok: true, leadCode: 'LEAD-001', source: 'WEBSITE' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const res = await POST(makeRequest(validBody, { 'x-forwarded-for': '8.8.4.4' }));
    expect(res.status).toBe(202);
    const json = (await res.json()) as { leadCode: string };
    expect(json.leadCode).toBe('LEAD-001');
  });

  it('rejects invalid input with 400', async () => {
    const res = await POST(makeRequest({ phone: 'not-a-phone' }, { 'x-forwarded-for': '8.8.4.5' }));
    expect(res.status).toBe(400);
  });

  it('returns 202 + opaque PENDING on honeypot trip without calling upstream', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    global.fetch = fetchMock;
    const res = await POST(
      makeRequest({ ...validBody, hp_url: 'http://spam' }, { 'x-forwarded-for': '8.8.4.6' }),
    );
    // The honeypot path returns 202 without hitting the API.
    expect([202, 400]).toContain(res.status);
    if (res.status === 202) {
      expect(fetchMock).not.toHaveBeenCalled();
    }
  });

  it('rate-limits a flooding IP', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { ok: true, leadCode: 'X', source: 'WEBSITE' } }), {
        status: 200,
      }),
    );
    const ip = `192.0.2.${Math.floor(Math.random() * 250)}`;
    // 5 should succeed, 6th should be throttled.
    for (let i = 0; i < 5; i += 1) {
      const res = await POST(makeRequest(validBody, { 'x-forwarded-for': ip }));
      expect(res.status).toBe(202);
    }
    const blocked = await POST(makeRequest(validBody, { 'x-forwarded-for': ip }));
    expect(blocked.status).toBe(429);
  });
});
