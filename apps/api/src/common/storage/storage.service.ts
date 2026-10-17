import { randomUUID } from 'node:crypto';

import type { LoadedServerEnv } from '@ac/config';
import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';

import { APP_CONFIG } from '../config/config.module';
import { presignUrl } from './sigv4';
import {
  assertUploadAllowed,
  buildObjectKey,
  DEFAULT_UPLOAD_MAX_BYTES,
  type UploadRequest,
} from './upload-policy';

export interface PresignedUpload {
  /** Presigned PUT URL — client uploads the raw bytes here. */
  uploadUrl: string;
  /** Stable URL to persist on domain rows (booking photos, avatars...). */
  publicUrl: string;
  /** Object key inside the bucket. */
  key: string;
  /** Headers the client must send with the PUT (they are signed). */
  headers: Record<string, string>;
  expiresAt: string;
}

export type StorageEnv = Pick<
  LoadedServerEnv,
  | 'S3_ENDPOINT'
  | 'S3_REGION'
  | 'S3_BUCKET'
  | 'S3_ACCESS_KEY_ID'
  | 'S3_SECRET_ACCESS_KEY'
  | 'S3_PUBLIC_URL'
  | 'S3_FORCE_PATH_STYLE'
  | 'UPLOAD_MAX_BYTES'
  | 'UPLOAD_URL_TTL_SECONDS'
>;

/**
 * S3-compatible object storage (AWS S3 in prod, MinIO locally).
 *
 * Only presigned URLs leave the server — clients never see credentials and
 * binary payloads never transit the API. Credentials are never logged.
 */
@Injectable()
export class StorageService {
  constructor(@Inject(APP_CONFIG) private readonly env: StorageEnv) {}

  get maxUploadBytes(): number {
    return this.env.UPLOAD_MAX_BYTES ?? DEFAULT_UPLOAD_MAX_BYTES;
  }

  isConfigured(): boolean {
    return Boolean(this.env.S3_BUCKET && this.env.S3_ACCESS_KEY_ID && this.env.S3_SECRET_ACCESS_KEY);
  }

  /** Issue a presigned PUT for a tenant-scoped object. */
  presignUpload(input: UploadRequest & { tenantId: string; scope: string; now?: Date }): PresignedUpload {
    const contentType = assertUploadAllowed(input, this.maxUploadBytes);
    const key = buildObjectKey({
      tenantId: input.tenantId,
      scope: input.scope,
      filename: input.filename,
      contentType,
      id: randomUUID(),
      now: input.now,
    });
    const headers: Record<string, string> = { 'content-type': contentType };
    if (input.sizeBytes != null) headers['content-length'] = String(input.sizeBytes);

    const ttl = this.env.UPLOAD_URL_TTL_SECONDS ?? 900;
    const now = input.now ?? new Date();
    const uploadUrl = this.sign('PUT', key, ttl, headers, now);
    return {
      uploadUrl,
      publicUrl: this.publicUrl(key),
      key,
      headers: { 'Content-Type': contentType },
      expiresAt: new Date(now.getTime() + ttl * 1000).toISOString(),
    };
  }

  /** Short-lived GET URL for private objects. */
  presignDownload(key: string, ttlSeconds?: number): string {
    return this.sign('GET', key, ttlSeconds ?? this.env.UPLOAD_URL_TTL_SECONDS ?? 900, {}, new Date());
  }

  publicUrl(key: string): string {
    const base = this.env.S3_PUBLIC_URL?.replace(/\/$/, '');
    if (base) return `${base}/${key}`;
    const { protocol, host, prefix } = this.location();
    return `${protocol}//${host}${prefix}/${key}`;
  }

  /**
   * Object key for a URL previously returned as `publicUrl`, or null when the
   * URL does not point at our bucket. Used to verify client-supplied media
   * URLs before attaching them to domain rows.
   */
  keyFromPublicUrl(url: string): string | null {
    const base = this.publicUrl('');
    if (!url.startsWith(base)) return null;
    const key = decodeURIComponent(url.slice(base.length).split('?')[0] ?? '');
    return key && !key.includes('..') ? key : null;
  }

  /** True when `url` is an object we issued for `tenantId`. */
  isTenantObjectUrl(url: string, tenantId: string): boolean {
    const key = this.keyFromPublicUrl(url);
    return !!key && key.startsWith(`${tenantId}/`);
  }

  private sign(
    method: 'GET' | 'PUT',
    key: string,
    ttl: number,
    headers: Record<string, string>,
    now: Date,
  ): string {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException('File uploads are not configured on this server');
    }
    const { protocol, host, prefix } = this.location();
    return presignUrl({
      method,
      protocol,
      host,
      path: `${prefix}/${key}`,
      region: this.env.S3_REGION ?? 'us-east-1',
      accessKeyId: this.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: this.env.S3_SECRET_ACCESS_KEY!,
      expiresInSeconds: ttl,
      signedHeaders: headers,
      now,
    });
  }

  private location(): { protocol: string; host: string; prefix: string } {
    const bucket = this.env.S3_BUCKET ?? '';
    const region = this.env.S3_REGION ?? 'us-east-1';
    if (this.env.S3_ENDPOINT) {
      const url = new URL(this.env.S3_ENDPOINT);
      const basePath = url.pathname.replace(/\/$/, '');
      if (this.env.S3_FORCE_PATH_STYLE ?? true) {
        return { protocol: url.protocol, host: url.host, prefix: `${basePath}/${bucket}` };
      }
      return { protocol: url.protocol, host: `${bucket}.${url.host}`, prefix: basePath };
    }
    return { protocol: 'https:', host: `${bucket}.s3.${region}.amazonaws.com`, prefix: '' };
  }
}
