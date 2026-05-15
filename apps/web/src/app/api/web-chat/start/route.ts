import { NextResponse } from 'next/server';
import { z } from 'zod';

import { env, siteConfig } from '@/env';
import { getClientIp, rateLimit } from '@/lib/rate-limit';

/**
 * `/api/web-chat/start` — public web-chat start proxy.
 *
 * Forwards to the support backend (`POST /api/v1/public/web-chat/start`)
 * but layers cheap, server-side rate limiting + tenant resolution before
 * the request leaves our edge.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const InputSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional().or(z.literal('')),
  initialMessage: z.string().max(2000).optional(),
  hp_url: z.string().max(0).optional(),
});

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const limit = rateLimit({ key: `web-chat-start:${ip}`, limit: 5, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'retry-after': '60' } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = InputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_input', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (parsed.data.hp_url && parsed.data.hp_url.length > 0) {
    return NextResponse.json(
      { sessionId: crypto.randomUUID(), conversationId: null },
      { status: 202 },
    );
  }

  const apiBase =
    process.env['WEB_INTERNAL_API_URL'] ?? env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  const url = `${apiBase}/api/v1/public/web-chat/start`;

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-ac-tenant': siteConfig.defaultTenantSlug,
        'x-forwarded-for': ip,
      },
      body: JSON.stringify({
        ...parsed.data,
        tenantSlug: siteConfig.defaultTenantSlug,
      }),
    });
    const json = await upstream.json().catch(() => null);
    const data =
      json && typeof json === 'object' && 'data' in (json as Record<string, unknown>)
        ? (json as { data: unknown }).data
        : json;
    return NextResponse.json(data, { status: upstream.ok ? 201 : 502 });
  } catch (err) {
    console.error('[/api/web-chat/start] upstream failed', err);
    return NextResponse.json({ error: 'network_error' }, { status: 502 });
  }
}
