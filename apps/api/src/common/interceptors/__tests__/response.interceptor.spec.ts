import { StreamableFile } from '@nestjs/common';
import { Readable } from 'node:stream';
import { lastValueFrom, of } from 'rxjs';

import { isRawResponse, ResponseInterceptor } from '../response.interceptor';

function run(data: unknown, headers: Record<string, string> = {}, sent = false) {
  const reply = { sent, getHeader: (k: string) => headers[k.toLowerCase()] };
  const ctx = {
    switchToHttp: () => ({ getRequest: () => ({ id: 'req-1' }), getResponse: () => reply }),
  };
  return lastValueFrom(new ResponseInterceptor().intercept(ctx as never, { handle: () => of(data) }));
}

describe('ResponseInterceptor', () => {
  it('wraps plain JSON results in the success envelope', async () => {
    await expect(run({ a: 1 })).resolves.toEqual({ success: true, data: { a: 1 }, requestId: 'req-1' });
  });

  it('passes through results that already carry an envelope', async () => {
    const body = { success: false, error: {} };
    await expect(run(body)).resolves.toBe(body);
  });

  it('leaves PDF buffers untouched', async () => {
    const pdf = Buffer.from('%PDF-1.7');
    await expect(run(pdf, { 'content-type': 'application/pdf' })).resolves.toBe(pdf);
  });

  it('treats streams, StreamableFile, sent replies and non-JSON content types as raw', () => {
    expect(isRawResponse(Readable.from(['a']))).toBe(true);
    expect(isRawResponse(new StreamableFile(Buffer.from('x')))).toBe(true);
    expect(isRawResponse({ a: 1 }, { sent: true, getHeader: () => undefined })).toBe(true);
    expect(isRawResponse('id,name', { sent: false, getHeader: () => 'text/csv' })).toBe(true);
    expect(isRawResponse({ a: 1 }, { sent: false, getHeader: () => 'application/json' })).toBe(false);
  });
});
