import { describe, expect, it } from 'vitest';

import { ApiClientError } from '../api-client';

describe('ApiClientError', () => {
  it('carries status, code and details', () => {
    const err = new ApiClientError(422, 'VALIDATION_ERROR', { field: 'phone' }, 'req_1');
    expect(err.status).toBe(422);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.details).toEqual({ field: 'phone' });
    expect(err.requestId).toBe('req_1');
  });
});
