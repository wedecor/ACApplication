jest.mock('../api-client', () => ({
  __esModule: true,
  api: {
    get: jest.fn(),
    post: jest.fn(async () => ({})),
    put: jest.fn(async () => ({})),
    patch: jest.fn(async () => ({})),
    delete: jest.fn(async () => ({})),
  },
  apiFetch: jest.fn(),
  ApiError: class ApiError extends Error {},
  onAuthLost: () => () => undefined,
}));

import { api } from '../api-client';
import { drain, enqueue, inspectQueue } from '../offline-queue';

describe('offline queue', () => {
  beforeEach(() => {
    (api.post as jest.Mock).mockReset();
    (api.patch as jest.Mock).mockReset();
    (api.delete as jest.Mock).mockReset();
  });

  it('drains queued requests in order', async () => {
    (api.post as jest.Mock).mockResolvedValue({});
    await enqueue({ method: 'POST', path: '/x/1', body: { a: 1 } });
    await enqueue({ method: 'POST', path: '/x/2', body: { a: 2 } });
    await drain();
    expect((api.post as jest.Mock).mock.calls.map((c) => c[0])).toEqual([
      '/x/1',
      '/x/2',
    ]);
    expect(inspectQueue()).toEqual([]);
  });

  it('keeps the request in the queue when the call fails', async () => {
    (api.post as jest.Mock).mockRejectedValue(new Error('boom'));
    await enqueue({ method: 'POST', path: '/x/3', body: {} });
    await drain();
    expect(inspectQueue().length).toBe(1);
    expect(inspectQueue()[0]!.retries).toBeGreaterThan(0);
  });
});
