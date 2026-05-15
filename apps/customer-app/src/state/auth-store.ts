import { create } from 'zustand';

import { api, ApiError, onAuthLost } from '@/lib/api-client';
import { getDeviceFingerprint } from '@/lib/device';
import { secureStore, SecureKeys } from '@/lib/secure-store';

export interface CustomerProfile {
  id: string;
  tenantId?: string;
  phone?: string;
  email?: string;
  fullName?: string;
  avatarUrl?: string | null;
  customerId?: string;
}

export type OtpChannel = 'sms' | 'whatsapp';

interface AuthState {
  status: 'idle' | 'hydrating' | 'authenticated' | 'unauthenticated';
  profile: CustomerProfile | null;
  isHydrated: boolean;
  pendingDestination: string | null;
  pendingChannel: OtpChannel;
  pendingTtlSeconds: number;
  pendingMaskedTo: string | null;

  hydrate: () => Promise<void>;
  requestOtp: (input: { destination: string; channel?: OtpChannel }) => Promise<{
    ttlSeconds: number;
    sentTo: string;
  }>;
  verifyOtp: (code: string) => Promise<void>;
  resend: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
}

const PROFILE_KEY = SecureKeys.Profile;

async function persistTokens(tokens: { accessToken: string; refreshToken: string }) {
  await secureStore.setItem(SecureKeys.AccessToken, tokens.accessToken);
  await secureStore.setItem(SecureKeys.RefreshToken, tokens.refreshToken);
}

async function clearAuthArtifacts() {
  await Promise.all([
    secureStore.removeItem(SecureKeys.AccessToken),
    secureStore.removeItem(SecureKeys.RefreshToken),
    secureStore.removeItem(SecureKeys.UserId),
    secureStore.removeItem(SecureKeys.TenantId),
    secureStore.removeItem(SecureKeys.Profile),
  ]);
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'idle',
  profile: null,
  isHydrated: false,
  pendingDestination: null,
  pendingChannel: 'sms',
  pendingTtlSeconds: 0,
  pendingMaskedTo: null,

  async hydrate() {
    set({ status: 'hydrating' });
    try {
      const access = await secureStore.getItem(SecureKeys.AccessToken);
      const cachedProfile = await secureStore.getItem(PROFILE_KEY);
      if (!access) {
        set({ status: 'unauthenticated', profile: null, isHydrated: true });
        return;
      }
      let profile: CustomerProfile | null = cachedProfile
        ? (JSON.parse(cachedProfile) as CustomerProfile)
        : null;
      try {
        const fresh = await api.get<CustomerProfile>('/v1/users/me');
        profile = fresh;
        await secureStore.setItem(PROFILE_KEY, JSON.stringify(fresh));
      } catch (err) {
        // If we can\u2019t reach the API on cold start we still trust the cached
        // session and let queries surface their own errors. A 401 will have
        // already triggered logout via onAuthLost.
        if (err instanceof ApiError && err.isAuth) {
          await clearAuthArtifacts();
          set({ status: 'unauthenticated', profile: null, isHydrated: true });
          return;
        }
      }
      set({ status: 'authenticated', profile, isHydrated: true });
    } catch {
      set({ status: 'unauthenticated', profile: null, isHydrated: true });
    }
  },

  async requestOtp({ destination, channel = 'sms' }) {
    const result = await api.post<{ ttlSeconds: number; sentTo: string }>(
      '/v1/auth/otp/request',
      { destination, purpose: 'LOGIN', channel },
      { skipAuth: true },
    );
    set({
      pendingDestination: destination,
      pendingChannel: channel,
      pendingTtlSeconds: result.ttlSeconds,
      pendingMaskedTo: result.sentTo,
    });
    return result;
  },

  async verifyOtp(code) {
    const destination = get().pendingDestination;
    if (!destination) throw new Error('No OTP request in progress.');
    const fingerprint = await getDeviceFingerprint();
    const response = await api.post<{
      accessToken: string;
      refreshToken: string;
      user: CustomerProfile;
    }>(
      '/v1/auth/otp/verify',
      {
        destination,
        code,
        device: {
          deviceId: fingerprint.deviceId,
          platform: fingerprint.platform,
          modelName: fingerprint.modelName,
          osVersion: fingerprint.osVersion,
          appVersion: fingerprint.appVersion,
        },
      },
      { skipAuth: true },
    );
    await persistTokens(response);
    await secureStore.setItem(SecureKeys.UserId, response.user.id);
    if (response.user.tenantId) {
      await secureStore.setItem(SecureKeys.TenantId, response.user.tenantId);
    }
    await secureStore.setItem(PROFILE_KEY, JSON.stringify(response.user));
    set({
      status: 'authenticated',
      profile: response.user,
      pendingDestination: null,
      pendingMaskedTo: null,
      pendingTtlSeconds: 0,
    });
  },

  async resend() {
    const destination = get().pendingDestination;
    const channel = get().pendingChannel;
    if (!destination) throw new Error('No OTP request in progress.');
    await get().requestOtp({ destination, channel });
  },

  async refreshProfile() {
    try {
      const fresh = await api.get<CustomerProfile>('/v1/users/me');
      await secureStore.setItem(PROFILE_KEY, JSON.stringify(fresh));
      set({ profile: fresh });
    } catch {
      /* swallow \u2014 caller can retry */
    }
  },

  async logout() {
    try {
      await api.post('/v1/auth/logout');
    } catch {
      /* best-effort */
    }
    await clearAuthArtifacts();
    set({ status: 'unauthenticated', profile: null });
  },

  async logoutAll() {
    try {
      await api.post('/v1/auth/logout-all');
    } catch {
      /* best-effort */
    }
    await clearAuthArtifacts();
    set({ status: 'unauthenticated', profile: null });
  },
}));

// When the api client detects an unrecoverable auth loss, force-logout so the
// shell routes back to /login on the next render.
onAuthLost(() => {
  useAuthStore.setState({ status: 'unauthenticated', profile: null });
  void clearAuthArtifacts();
});
