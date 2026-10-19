import { fastifyClientError } from '../global-exception.filter';

describe('fastifyClientError', () => {
  it('maps Fastify 4xx errors to client errors', () => {
    const err = Object.assign(new Error("Body cannot be empty when content-type is set to 'application/json'"), {
      code: 'FST_ERR_CTP_EMPTY_JSON_BODY',
      statusCode: 400,
    });
    expect(fastifyClientError(err)).toMatchObject({ statusCode: 400, code: 'BAD_REQUEST' });
  });

  it('leaves everything else as an internal error', () => {
    expect(fastifyClientError(new Error('boom'))).toBeNull();
    expect(fastifyClientError(Object.assign(new Error('x'), { code: 'FST_SOMETHING', statusCode: 500 }))).toBeNull();
  });
});
