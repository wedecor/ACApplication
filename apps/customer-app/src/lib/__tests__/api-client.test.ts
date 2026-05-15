import { api, ApiError, onAuthLost } from '../api-client';
import { secureStore, SecureKeys } from '../secure-store';

describe('api-client', () => {
  let originalFetch: typeof fetch;
  beforeEach(() => {
    originalFetch = global.fetch as typeof fetch;
    void secureStore.removeItem(SecureKeys.AccessToken);
    void secureStore.removeItem(SecureKeys.RefreshToken);
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('attaches Authorization header when an access token is stored', async () => {
    await secureStore.setItem(SecureKeys.AccessToken, 'TOKEN');
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    global.fetch = jest.fn(async (input: any, init?: RequestInit) => {
      calls.push({ url: typeof input === 'string' ? input : input.url, init });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as unknown as typeof fetch;
    await api.get('/v1/users/me');
    const headers = calls[0]!.init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer TOKEN');
  });

  it('throws ApiError with status on non-2xx', async () => {
    global.fetch = jest.fn(async () => new Response(JSON.stringify({ message: 'nope' }), { status: 400 })) as unknown as typeof fetch;
    await expect(api.get('/v1/x')).rejects.toBeInstanceOf(ApiError);
  });

  it('attempts refresh once on 401 and retries the request', async () => {
    await secureStore.setItem(SecureKeys.AccessToken, 'EXPIRED');
    await secureStore.setItem(SecureKeys.RefreshToken, 'REFRESH');
    let callCount = 0;
    global.fetch = jest.fn(async (input: any) => {
      callCount += 1;
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/auth/refresh')) {
        return new Response(JSON.stringify({ accessToken: 'NEW', refreshToken: 'NEWREFRESH' }), { status: 200 });
      }
      if (callCount === 1) {
        return new Response('', { status: 401 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as unknown as typeof fetch;
    const result = await api.get<{ ok: boolean }>('/v1/users/me');
    expect(result.ok).toBe(true);
    expect(await secureStore.getItem(SecureKeys.AccessToken)).toBe('NEW');
  });

  it('broadcasts auth loss when refresh fails', async () => {
    await secureStore.setItem(SecureKeys.AccessToken, 'EXPIRED');
    await secureStore.setItem(SecureKeys.RefreshToken, 'REFRESH');
    global.fetch = jest.fn(async (input: any) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/auth/refresh')) return new Response('', { status: 401 });
      return new Response('', { status: 401 });
    }) as unknown as typeof fetch;
    const handler = jest.fn();
    const unsub = onAuthLost(handler);
    await expect(api.get('/v1/users/me')).rejects.toBeInstanceOf(ApiError);
    expect(handler).toHaveBeenCalled();
    unsub();
  });

  it('returns undefined for 204 responses', async () => {
    global.fetch = jest.fn(async () => new Response(null, { status: 204 })) as unknown as typeof fetch;
    await expect(api.delete('/v1/x')).resolves.toBeUndefined();
  });

  it('wraps network errors as ApiError with status 0', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('boom');
    }) as unknown as typeof fetch;
    try {
      await api.get('/v1/x');
      fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(0);
      expect((err as ApiError).isNetwork).toBe(true);
    }
  });
});
