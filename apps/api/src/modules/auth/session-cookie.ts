import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Browser clients (the admin CRM) opt into keeping the refresh token in an
 * httpOnly cookie by sending `x-session-transport: cookie`. Scripts on the
 * page then can't read the long-lived token; the custom header also forces a
 * CORS preflight, so other sites can't trigger a cookie refresh.
 */
export const REFRESH_COOKIE = 'ac_rt';
export const SESSION_TRANSPORT_HEADER = 'x-session-transport';

export function wantsCookieTransport(req: FastifyRequest): boolean {
  return req.headers[SESSION_TRANSPORT_HEADER] === 'cookie';
}

export function readRefreshCookie(req: FastifyRequest): string | undefined {
  const value = (req as FastifyRequest & { cookies?: Record<string, string | undefined> }).cookies?.[REFRESH_COOKIE];
  return value || undefined;
}

export function setRefreshCookie(reply: FastifyReply, token: string, expiresAt: string): void {
  void reply.setCookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    sameSite: 'strict',
    path: '/api/v1/auth',
    expires: new Date(expiresAt),
  });
}

export function clearRefreshCookie(reply: FastifyReply): void {
  void reply.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
}

/** The token response without the refresh token (it travels in the cookie instead). */
export function withoutRefreshToken<T extends { refreshToken: string }>(res: T): Omit<T, 'refreshToken'> {
  const { refreshToken: _omit, ...rest } = res;
  return rest;
}
