import { NextResponse } from 'next/server';
import { z } from 'zod';

import { env, siteConfig } from '@/env';
import { getClientIp, rateLimit } from '@/lib/rate-limit';

/**
 * `/api/web-chat/messages` — proxy for web-chat send + poll.
 *
 * GET  ?sessionId=…&after=<iso> → fetch unread messages
 * POST { sessionId, body }      → post a visitor reply
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SendSchema = z.object({
  sessionId: z.string().min(8).max(120),
  body: z.string().min(1).max(4000),
  hp_url: z.string().max(0).optional(),
});

function upstreamBase(): string {
  return (
    process.env['WEB_INTERNAL_API_URL'] ??
    env.NEXT_PUBLIC_API_URL ??
    'http://localhost:4000'
  );
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const limit = rateLimit({ key: `web-chat-send:${ip}`, limit: 30, windowMs: 60_000 });
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
  const parsed = SendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_input', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  if (parsed.data.hp_url && parsed.data.hp_url.length > 0) {
    return NextResponse.json({ ok: true, messageId: null }, { status: 202 });
  }

  const url = `${upstreamBase()}/api/v1/public/web-chat/${encodeURIComponent(
    parsed.data.sessionId,
  )}/messages?tenantSlug=${encodeURIComponent(siteConfig.defaultTenantSlug)}`;
  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-ac-tenant': siteConfig.defaultTenantSlug,
        'x-forwarded-for': ip,
      },
      body: JSON.stringify({ body: parsed.data.body }),
    });
    const json = await upstream.json().catch(() => null);
    const data =
      json && typeof json === 'object' && 'data' in (json as Record<string, unknown>)
        ? (json as { data: unknown }).data
        : json;
    return NextResponse.json(data, { status: upstream.ok ? 200 : 502 });
  } catch (err) {
    console.error('[/api/web-chat/messages POST] upstream failed', err);
    return NextResponse.json({ error: 'network_error' }, { status: 502 });
  }
}

export async function GET(req: Request) {
  const ip = getClientIp(req);
  const limit = rateLimit({ key: `web-chat-poll:${ip}`, limit: 120, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json({ items: [] }, { status: 429 });
  }
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  if (!sessionId) {
    return NextResponse.json({ error: 'missing_session' }, { status: 400 });
  }
  const after = searchParams.get('after');
  const url = new URL(
    `/api/v1/public/web-chat/${encodeURIComponent(sessionId)}/messages`,
    upstreamBase(),
  );
  url.searchParams.set('tenantSlug', siteConfig.defaultTenantSlug);
  if (after) url.searchParams.set('after', after);
  try {
    const upstream = await fetch(url.toString(), {
      headers: { 'x-ac-tenant': siteConfig.defaultTenantSlug },
      cache: 'no-store',
    });
    const json = await upstream.json().catch(() => null);
    const data =
      json && typeof json === 'object' && 'data' in (json as Record<string, unknown>)
        ? (json as { data: unknown }).data
        : json;
    return NextResponse.json(data ?? { items: [] }, {
      status: upstream.ok ? 200 : 502,
    });
  } catch (err) {
    console.error('[/api/web-chat/messages GET] upstream failed', err);
    return NextResponse.json({ items: [] }, { status: 502 });
  }
}
