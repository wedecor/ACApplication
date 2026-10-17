import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';

/** MIME types we accept for direct uploads (photos + documents). */
export const ALLOWED_UPLOAD_CONTENT_TYPES: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
};

export const DEFAULT_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

export interface UploadRequest {
  filename: string;
  contentType: string;
  sizeBytes?: number;
}

/**
 * Validates a presign request. Throws `BadRequestException` for an
 * unsupported content type and `PayloadTooLargeException` when the declared
 * size is over the cap. Returns the normalised content type.
 */
export function assertUploadAllowed(req: UploadRequest, maxBytes: number): string {
  const contentType = req.contentType.trim().toLowerCase();
  if (!ALLOWED_UPLOAD_CONTENT_TYPES[contentType]) {
    throw new BadRequestException(
      `Unsupported content type. Allowed: ${Object.keys(ALLOWED_UPLOAD_CONTENT_TYPES).join(', ')}`,
    );
  }
  if (req.sizeBytes != null) {
    if (!Number.isFinite(req.sizeBytes) || req.sizeBytes <= 0) {
      throw new BadRequestException('sizeBytes must be a positive integer');
    }
    if (req.sizeBytes > maxBytes) {
      throw new PayloadTooLargeException(`File exceeds the ${Math.floor(maxBytes / 1024 / 1024)} MB limit`);
    }
  }
  return contentType;
}

/**
 * Builds a collision-free, tenant-scoped object key. The original filename
 * is slugged (never trusted as a path) and the extension is derived from the
 * validated content type so `evil.php` uploaded as image/png becomes `.png`.
 */
export function buildObjectKey(input: {
  tenantId: string;
  scope: string;
  filename: string;
  contentType: string;
  id: string;
  now?: Date;
}): string {
  const ext = ALLOWED_UPLOAD_CONTENT_TYPES[input.contentType] ?? 'bin';
  const base =
    input.filename
      .replace(/\.[^.]*$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'file';
  const d = input.now ?? new Date();
  const month = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  const scope = input.scope.replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'misc';
  const tenant = input.tenantId.replace(/[^a-z0-9-]/gi, '');
  return `${tenant}/${scope}/${month}/${input.id}-${base}.${ext}`;
}
