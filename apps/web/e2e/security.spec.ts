/**
 * Security e2e tests — uses Playwright's `request` fixture (APIRequestContext)
 * for direct HTTP calls against the NestJS API. These tests do NOT require a
 * browser. They are API-level security regression tests.
 *
 * The API server must be running for tests to pass; when it is not reachable
 * the suite skips gracefully so CI pipelines that don't boot the API are
 * unaffected.
 *
 * Environment variables:
 *   NEXT_PUBLIC_API_URL  – defaults to http://localhost:3001
 */

import type { APIRequestContext } from '@playwright/test';
import { expect, test } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const API_BASE =
  (process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001').replace(/\/$/, '') +
  '/api/v1';

/** Random E.164-ish phone number unique per test run. */
function randomPhone(): string {
  return `+91999${Math.floor(Math.random() * 10_000_000)
    .toString()
    .padStart(7, '0')}`;
}

/**
 * Attempt a lightweight probe to see if the API is up.
 * Returns true when the server responds (any status is fine).
 */
async function isApiReachable(request: APIRequestContext): Promise<boolean> {
  try {
    // Hit the OTP endpoint with an intentionally invalid body — we only care
    // about getting *any* HTTP response back, not a 2xx.
    await request.post(`${API_BASE}/auth/otp/request`, {
      data: {},
      timeout: 3_000,
    });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// 1. Login and Logout
// ---------------------------------------------------------------------------

test.describe('Auth — login and logout', () => {
  test('can request OTP, verify it (dev code), obtain tokens, and logout invalidates the session', async ({
    request,
  }) => {
    if (!(await isApiReachable(request))) {
      test.skip(true, 'API server is not reachable — skipping security tests');
      return;
    }

    const destination = randomPhone();

    // 1a. Request OTP
    const otpReq = await request.post(`${API_BASE}/auth/otp/request`, {
      data: { destination },
    });
    // 202 Accepted is the expected success status
    expect(
      [202, 429].includes(otpReq.status()),
      `otp/request returned unexpected status ${otpReq.status()}`,
    ).toBe(true);

    if (otpReq.status() === 429) {
      test.skip(true, 'Hit OTP rate limit on the test phone number — skipping');
      return;
    }

    const otpBody = (await otpReq.json()) as Record<string, unknown>;

    // In development mode the server echoes the code as `devCode`
    const devCode = otpBody['devCode'] as string | undefined;
    if (!devCode) {
      test.skip(true, 'devCode not present — API is not in development mode, skipping login test');
      return;
    }

    // 1b. Verify OTP — obtain access + refresh tokens
    const verifyRes = await request.post(`${API_BASE}/auth/otp/verify`, {
      data: { destination, code: devCode },
    });
    // Could be 200 (tokens issued) or 201 / 401 depending on user existence
    // In a fresh test DB the user won't exist → 401. That's acceptable.
    if (verifyRes.status() === 401) {
      test.skip(true, 'No active user for this phone in the test DB — skipping full login/logout flow');
      return;
    }
    expect(verifyRes.status()).toBe(200);

    const tokenBody = (await verifyRes.json()) as Record<string, unknown>;
    expect(typeof tokenBody['accessToken']).toBe('string');
    const accessToken = tokenBody['accessToken'] as string;
    const refreshToken = tokenBody['refreshToken'] as string | undefined;

    // 1c. Verify the access token works on a protected endpoint
    const meRes = await request.post(`${API_BASE}/auth/logout`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // 204 No Content is the expected logout response
    expect(meRes.status()).toBe(204);

    // 1d. After logout the refresh token must be invalidated
    if (refreshToken) {
      const refreshAfterLogout = await request.post(`${API_BASE}/auth/refresh`, {
        data: { refreshToken },
      });
      expect(refreshAfterLogout.status()).toBe(401);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. httpOnly refresh-cookie and refresh-token reuse detection
// ---------------------------------------------------------------------------

test.describe('Auth — refresh token reuse detection', () => {
  test('replaying a consumed refresh token returns 401', async ({ request }) => {
    if (!(await isApiReachable(request))) {
      test.skip(true, 'API server is not reachable — skipping security tests');
      return;
    }

    const destination = randomPhone();

    const otpReq = await request.post(`${API_BASE}/auth/otp/request`, {
      data: { destination },
    });
    if (otpReq.status() !== 202) {
      test.skip(true, `OTP request returned ${otpReq.status()} — skipping`);
      return;
    }
    const otpBody = (await otpReq.json()) as Record<string, unknown>;
    const devCode = otpBody['devCode'] as string | undefined;
    if (!devCode) {
      test.skip(true, 'devCode not present — not in development mode');
      return;
    }

    const verifyRes = await request.post(`${API_BASE}/auth/otp/verify`, {
      data: { destination, code: devCode },
    });
    if (verifyRes.status() !== 200) {
      test.skip(true, `OTP verify returned ${verifyRes.status()} — no user in DB`);
      return;
    }

    const tokenBody = (await verifyRes.json()) as Record<string, unknown>;
    const refreshToken = tokenBody['refreshToken'] as string | undefined;

    if (!refreshToken) {
      // Cookie transport — the refresh token is in an httpOnly cookie.
      // We verify the cookie is present and marked HttpOnly.
      const setCookieHeader = verifyRes.headers()['set-cookie'] ?? '';
      expect(setCookieHeader.toLowerCase()).toContain('httponly');

      // Replay attack via cookie — make two consecutive calls.
      // The second must fail because the first rotated the token.
      const first = await request.post(`${API_BASE}/auth/refresh`, { data: {} });
      // First call may succeed (200) or already fail if cookie jar is empty.
      if (first.status() === 200) {
        const second = await request.post(`${API_BASE}/auth/refresh`, { data: {} });
        expect(second.status()).toBe(401);
      }
      return;
    }

    // Body transport — explicit refreshToken in the JSON response.
    // First refresh: should succeed (200)
    const firstRefresh = await request.post(`${API_BASE}/auth/refresh`, {
      data: { refreshToken },
    });
    expect(firstRefresh.status()).toBe(200);

    // Replay attack — use the *same* original refresh token again.
    // The server must have rotated it, so the second use must return 401.
    const secondRefresh = await request.post(`${API_BASE}/auth/refresh`, {
      data: { refreshToken },
    });
    expect(
      secondRefresh.status(),
      'Replayed refresh token should be rejected with 401',
    ).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// 3. OTP rate limiting
// ---------------------------------------------------------------------------

test.describe('Auth — OTP rate limiting', () => {
  test('hammering otp/request for the same destination eventually returns 429', async ({
    request,
  }) => {
    if (!(await isApiReachable(request))) {
      test.skip(true, 'API server is not reachable — skipping security tests');
      return;
    }

    // The throttle decorator allows 5 requests per 60 s (per the controller).
    // We send 10 to guarantee we exceed the limit.
    const destination = randomPhone();
    const ATTEMPTS = 10;
    let got429 = false;

    for (let i = 0; i < ATTEMPTS; i++) {
      const res = await request.post(`${API_BASE}/auth/otp/request`, {
        data: { destination },
      });
      if (res.status() === 429) {
        got429 = true;
        break;
      }
      // Any other non-2xx besides 429 is unexpected; stop early.
      if (res.status() >= 500) {
        throw new Error(`Server error on attempt ${i + 1}: ${res.status()}`);
      }
    }

    expect(got429, 'Expected 429 after exceeding OTP rate limit').toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. Tenant isolation
// ---------------------------------------------------------------------------

test.describe('Auth — tenant isolation', () => {
  test('a token issued for tenant A cannot read tenant B resources', async ({
    request,
  }) => {
    if (!(await isApiReachable(request))) {
      test.skip(true, 'API server is not reachable — skipping security tests');
      return;
    }

    // We need a real access token to probe the isolation check.
    const destination = randomPhone();
    const otpReq = await request.post(`${API_BASE}/auth/otp/request`, {
      data: { destination },
    });
    if (otpReq.status() !== 202) {
      test.skip(true, `OTP request returned ${otpReq.status()} — skipping`);
      return;
    }
    const otpBody = (await otpReq.json()) as Record<string, unknown>;
    const devCode = otpBody['devCode'] as string | undefined;
    if (!devCode) {
      test.skip(true, 'devCode not present — not in development mode');
      return;
    }

    const verifyRes = await request.post(`${API_BASE}/auth/otp/verify`, {
      data: { destination, code: devCode },
    });
    if (verifyRes.status() !== 200) {
      test.skip(true, `OTP verify returned ${verifyRes.status()} — no user in DB`);
      return;
    }

    const tokenBody = (await verifyRes.json()) as Record<string, unknown>;
    const accessToken = tokenBody['accessToken'] as string;

    // Decode the JWT (without verification — we just need the tenantId claim).
    const [, payloadB64] = accessToken.split('.');
    if (!payloadB64) {
      test.skip(true, 'Could not decode access token payload');
      return;
    }
    const payload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8'),
    ) as Record<string, unknown>;
    const ownTenantId = payload['tenantId'] as string | undefined;

    if (!ownTenantId) {
      test.skip(true, 'tenantId not in JWT payload — cannot run isolation test');
      return;
    }

    // Construct a *different* tenant ID by mutating the last character.
    const lastChar = ownTenantId[ownTenantId.length - 1] ?? '0';
    const differentTenantId =
      ownTenantId.slice(0, -1) + (lastChar === '0' ? '1' : '0');

    // Attempt to read a resource that belongs to the other tenant.
    // The server must respond 403 or 404 — never 200.
    const crossTenantRes = await request.get(
      `${API_BASE}/tenants/${differentTenantId}/customers`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        failOnStatusCode: false,
      },
    );

    expect(
      [403, 404].includes(crossTenantRes.status()),
      `Cross-tenant request should return 403 or 404, got ${crossTenantRes.status()}`,
    ).toBe(true);
  });
});
