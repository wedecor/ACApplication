import { apiFetch } from '@/lib/api/client';

export interface RequestOtpResponse {
  ttlSeconds: number;
  sentTo: string;
  devCode?: string;
}

export interface VerifyOtpResponse {
  accessToken: string;
  refreshToken: string;
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
    }),
};
