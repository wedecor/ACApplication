import { scrubEvent } from './instrument';

describe('scrubEvent', () => {
  it('drops bodies, cookies, secrets in headers and query strings', () => {
    const out = scrubEvent({
      request: {
        url: '/api/v1/quotations/public/tok?sig=abc',
        data: { code: '123456' },
        cookies: { ac_rt: 'x' },
        query_string: 'sig=abc',
        headers: { authorization: 'Bearer t', 'user-agent': 'ua', 'x-internal-token': 's' },
      },
    });
    expect(out.request).toEqual({ url: '/api/v1/quotations/public/tok', headers: { 'user-agent': 'ua' } });
  });
});
