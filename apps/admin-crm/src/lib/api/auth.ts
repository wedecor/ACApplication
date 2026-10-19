import { apiFetch, COOKIE_TRANSPORT } from '@/lib/api/client';

export interface RequestOtpResponse {
  ttlSeconds: number;
  sentTo: string;
  devCode?: string;
}

export interface VerifyOtpResponse {
  accessToken: string;
  /** Absent in cookie transport — the API sets it as an httpOnly cookie. */
  refreshToken?: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  permissionVersion: number;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    email: string | null;
    roles: string[];
  };
}

export const authApi = {
  requestOtp: (destination: string) =>
    apiFetch<RequestOtpResponse>('/auth/otp/request', {
      method: 'POST',
      body: { destination, purpose: 'LOGIN' },
    }),

  verifyOtp: (destination: string, code: string) =>
    apiFetch<VerifyOtpResponse>('/auth/otp/verify', {
      method: 'POST',
      body: { destination, code },
      headers: COOKIE_TRANSPORT,
    }),

  /** Revokes the session server-side and clears the refresh cookie. */
  logout: () => apiFetch<void>('/auth/logout', { method: 'POST', headers: COOKIE_TRANSPORT }),
};
