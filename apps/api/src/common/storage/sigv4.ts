import { createHash, createHmac } from 'node:crypto';

/**
 * Dependency-free AWS Signature V4 query-string presigner for S3-compatible
 * object stores (AWS S3, MinIO, R2, ...).
 *
 * We only need presigned PUT / GET URLs, so pulling the whole AWS SDK into
 * the API bundle is not worth it. The algorithm follows
 * https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html
 * and is verified against the reference vector from that page in the spec.
 */
export interface PresignInput {
  method: 'GET' | 'PUT';
  /** `https:` / `http:` */
  protocol: string;
  /** Host header value, including a non-default port (e.g. `localhost:9000`). */
  host: string;
  /** Absolute, *unencoded* object path, e.g. `/bucket/tenant/a b.jpg`. */
  path: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  expiresInSeconds: number;
  /** Extra headers the client MUST send verbatim (signed). Keys any case. */
  signedHeaders?: Record<string, string>;
  now?: Date;
}

/** RFC 3986 encoding as required by SigV4 (`~` stays, everything else escaped). */
export function rfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function encodePath(path: string): string {
  return path
    .split('/')
    .map((segment) => rfc3986(segment))
    .join('/');
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac('sha256', key).update(value, 'utf8').digest();
}

/** `20130524T000000Z` */
export function amzDate(d: Date): string {
  return d.toISOString().replace(/[:-]/g, '').replace(/\.\d{3}/, '');
}

export function presignUrl(input: PresignInput): string {
  const now = input.now ?? new Date();
  const stamp = amzDate(now);
  const day = stamp.slice(0, 8);
  const scope = `${day}/${input.region}/s3/aws4_request`;

  const headers: Record<string, string> = { host: input.host };
  for (const [k, v] of Object.entries(input.signedHeaders ?? {})) {
    headers[k.toLowerCase()] = v.trim();
  }
  const headerNames = Object.keys(headers).sort();
  const signedHeaderList = headerNames.join(';');
  const canonicalHeaders = headerNames.map((h) => `${h}:${headers[h]}\n`).join('');

  const query: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${input.accessKeyId}/${scope}`,
    'X-Amz-Date': stamp,
    'X-Amz-Expires': String(input.expiresInSeconds),
    'X-Amz-SignedHeaders': signedHeaderList,
  };
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((k) => `${rfc3986(k)}=${rfc3986(query[k]!)}`)
    .join('&');

  const canonicalUri = encodePath(input.path);
  const canonicalRequest = [
    input.method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaderList,
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    stamp,
    scope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = hmac(`AWS4${input.secretAccessKey}`, day);
  const kRegion = hmac(kDate, input.region);
  const kService = hmac(kRegion, 's3');
  const kSigning = hmac(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

  return `${input.protocol}//${input.host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}
