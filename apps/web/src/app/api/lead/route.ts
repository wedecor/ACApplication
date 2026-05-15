import { NextResponse } from 'next/server';
import { z } from 'zod';

import { env } from '@/env';
import { getClientIp, rateLimit } from '@/lib/rate-limit';

/**
 * `/api/lead` — public lead-intake proxy.
 *
 * Why proxy rather than call the backend directly from the browser?
 *  1. Server-side rate limiting (`rateLimit()`) catches obvious abuse
 *     before it reaches the API.
 *  2. Avoid CORS pain — the browser talks to its own origin.
 *  3. Allows us to attach a server-only `PUBLIC_LEAD_API_TOKEN` for the
 *     backend to verify the request originated from our own deployment.
 *  4. Keeps the public `NEXT_PUBLIC_API_URL` clear of mutating endpoints.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PHONE_REGEX = /^\+\d{8,15}$/;

const InputSchema = z.object({
  customerName: z.string().min(2).max(120),
  phone: z.string().regex(PHONE_REGEX),
  whatsappNumber: z.string().regex(PHONE_REGEX).optional(),
  email: z.string().email().optional().or(z.literal('')),
  applianceType: z.string().max(40).optional(),
  applianceBrand: z.string().max(80).optional(),
  issueDescription: z.string().max(2000).optional(),
  addressLine1: z.string().max(200).optional(),
  landmark: z.string().max(120).optional(),
  cityLabel: z.string().max(80).optional(),
  cityId: z.string().optional(),
  pincode: z
    .string()
    .regex(/^\d{4,8}$/)
    .optional(),
  source: z
    .enum(['WEBSITE', 'GOOGLE_ADS', 'WHATSAPP', 'FACEBOOK', 'INSTAGRAM'])
    .optional(),
  originUrl: z.string().max(500).optional(),
  utm: z.record(z.string()).optional(),
  hp_url: z.string().max(0).optional(), // honeypot — must be empty
});

export async function POST(req: Request) {
  const ip = getClientIp(req);

  // Belt-and-braces rate limit — 5 requests / minute / IP.
  const limit = rateLimit({ key: `lead:${ip}`, limit: 5, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'rate_limited', message: 'Too many submissions. Please try again in a minute.' },
      {
        status: 429,
        headers: {
          'retry-after': String(Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000))),
        },
      },
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
    // Pretend success — bots get a 202 too. No backend hit.
    return NextResponse.json({ ok: true, leadCode: 'PENDING', source: 'WEBSITE' }, { status: 202 });
  }

  const apiBase =
    process.env['WEB_INTERNAL_API_URL'] ?? env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  const url = `${apiBase}/api/v1/public/leads`;

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-ac-tenant': process.env['NEXT_PUBLIC_TENANT_SLUG'] ?? 'default',
        ...(process.env['PUBLIC_LEAD_API_TOKEN']
          ? { 'x-internal-token': process.env['PUBLIC_LEAD_API_TOKEN']! }
          : {}),
        ...(req.headers.get('user-agent') ? { 'user-agent': req.headers.get('user-agent')! } : {}),
        ...(req.headers.get('referer') ? { referer: req.headers.get('referer')! } : {}),
        'x-forwarded-for': ip,
      },
      body: JSON.stringify(parsed.data),
    });

    if (!upstream.ok) {
      // Surface 400 (validation), 429 (throttled) — opaque-otherwise.
      const status = upstream.status >= 400 && upstream.status < 500 ? upstream.status : 502;
      return NextResponse.json(
        {
          error: 'upstream_error',
          message: 'We could not submit your request just now. Please call us instead.',
        },
        { status },
      );
    }

    const json = await upstream.json().catch(() => null);
    // The Nest API wraps responses in `{ success: true, data: {…} }`.
    const data =
      json && typeof json === 'object' && 'data' in (json as Record<string, unknown>)
        ? (json as { data: unknown }).data
        : json;

    return NextResponse.json(data, { status: 202 });
  } catch (err) {
    console.error('[/api/lead] upstream call failed', err);
    return NextResponse.json(
      {
        error: 'network_error',
        message: 'We could not reach our booking system. Please call or WhatsApp us.',
      },
      { status: 502 },
    );
  }
}
