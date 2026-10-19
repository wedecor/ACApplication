/**
 * Direct-to-storage uploads:
 *   1. POST /uploads/presign { filename, contentType } → { uploadUrl, publicUrl }
 *   2. PUT the local file to `uploadUrl` (binary body, streamed by expo-file-system
 *      so a 4 MB photo never sits in JS memory).
 *
 * Pending files are copied into the app's document directory before being
 * queued, so an OS cache purge can't lose an un-uploaded photo/signature.
 */
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';

import { ApiError } from './api';
import { uploadsApi } from './repair-api';
import { storageKeyFromPresign } from './upload-key';

const PENDING_DIR = `${FileSystem.documentDirectory ?? ''}ac-pending/`;

export interface UploadedFile {
  publicUrl: string;
  storageKey: string;
  sizeBytes: number | undefined;
  contentType: string;
}

export function extensionFor(contentType: string): string {
  switch (contentType) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/heic':
      return 'heic';
    default:
      return 'jpg';
  }
}

export async function uploadLocalFile(input: {
  localUri: string;
  contentType: string;
  filename?: string;
}): Promise<UploadedFile> {
  const info = await FileSystem.getInfoAsync(input.localUri);
  if (!info.exists) throw new ApiError('Local file is missing', 410);
  // The size is signed into the presigned URL, so it must be known up front.
  const sizeBytes = 'size' in info && typeof info.size === 'number' ? info.size : undefined;
  if (!sizeBytes) throw new ApiError('Could not read the file size', 400);
  const filename = input.filename ?? `${Crypto.randomUUID()}.${extensionFor(input.contentType)}`;

  const presign = await uploadsApi.presign({
    filename,
    contentType: input.contentType,
    sizeBytes,
  });

  const res = await FileSystem.uploadAsync(presign.uploadUrl, input.localUri, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { 'Content-Type': input.contentType, ...(presign.headers ?? {}) },
  });
  if (res.status < 200 || res.status >= 300) {
    throw new ApiError(`Upload failed (HTTP ${res.status})`, res.status);
  }
  return {
    publicUrl: presign.publicUrl,
    storageKey: storageKeyFromPresign(presign),
    sizeBytes,
    contentType: input.contentType,
  };
}

/** Copy a picker/camera temp file somewhere durable for the offline queue. */
export async function persistForQueue(localUri: string, ext: string): Promise<string> {
  await FileSystem.makeDirectoryAsync(PENDING_DIR, { intermediates: true }).catch(() => undefined);
  const dest = `${PENDING_DIR}${Crypto.randomUUID()}.${ext}`;
  await FileSystem.copyAsync({ from: localUri, to: dest });
  return dest;
}

/** Write a `data:image/png;base64,...` signature to a durable file. */
export async function writeDataUrlToFile(dataUrl: string): Promise<{ uri: string; contentType: string }> {
  const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  const contentType = match?.[1] ?? 'image/png';
  const base64 = match?.[2] ?? dataUrl;
  await FileSystem.makeDirectoryAsync(PENDING_DIR, { intermediates: true }).catch(() => undefined);
  const uri = `${PENDING_DIR}signature-${Crypto.randomUUID()}.${extensionFor(contentType)}`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  return { uri, contentType };
}

/** Best-effort cleanup once a queued file has been uploaded. */
export async function discardPendingFile(uri: string): Promise<void> {
  if (!uri.startsWith(PENDING_DIR)) return;
  await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
}
