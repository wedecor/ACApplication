import { describe, expect, it, vi } from 'vitest';

// api.ts imports expo-constants + secure store for the client itself; the
// error helpers are pure, so stub the native modules.
vi.mock('expo-constants', () => ({ default: { expoConfig: null } }));
vi.mock('../auth', () => ({ getAuthToken: () => Promise.resolve(null) }));

const { ApiError, apiErrorCode, apiErrorDetails, apiErrorMessage, isNetworkError, isNotFound } = await import('../api');

const body = JSON.stringify({
  success: false,
  error: {
    code: 'CHECKLIST_INCOMPLETE',
    message: '1 required checklist item(s) not answered',
    statusCode: 400,
    details: { code: 'CHECKLIST_INCOMPLETE', missing: [{ key: 'k' }] },
  },
});

describe('api error helpers', () => {
  it('reads code, message and details from the global filter envelope', () => {
    const err = new ApiError(body, 400);
    expect(apiErrorCode(err)).toBe('CHECKLIST_INCOMPLETE');
    expect(apiErrorMessage(err)).toBe('1 required checklist item(s) not answered');
    expect(apiErrorDetails(err)).toMatchObject({ missing: [{ key: 'k' }] });
  });

  it('classifies 404 vs network failures', () => {
    expect(isNotFound(new ApiError('x', 404))).toBe(true);
    expect(isNetworkError(new ApiError('x', 500))).toBe(false);
    expect(isNetworkError(new TypeError('Network request failed'))).toBe(true);
    expect(apiErrorCode(new Error('plain'))).toBeNull();
  });
});
