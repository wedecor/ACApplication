/**
 * Strip bearer-equivalent tokens from request URLs before they are logged:
 * public quotation view tokens, signed rating links, web-chat sessions and
 * signed-download `sig`/`token` query params.
 */
const PATH_TOKENS = [
  /(\/quotations\/public\/)[^/?#]+/,
  /(\/public\/ratings\/)[^/?#]+/,
  /(\/public\/web-chat\/)[^/?#]+/,
];
const QUERY_TOKENS = /([?&](?:sig|token|signature|code)=)[^&#]*/gi;

export function redactUrl(url: unknown): unknown {
  if (typeof url !== 'string') return url;
  let out = url;
  for (const re of PATH_TOKENS) out = out.replace(re, '$1[REDACTED]');
  return out.replace(QUERY_TOKENS, '$1[REDACTED]');
}
