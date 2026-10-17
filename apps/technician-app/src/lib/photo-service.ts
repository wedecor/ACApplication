/**
 * Online-first photo attach with an offline fallback: try presign → PUT →
 * POST /bookings/:id/attachments right away; if there's no signal (or the
 * uploads endpoint isn't deployed yet) persist the file and queue it.
 */
import { apiErrorMessage, isNetworkError, isNotFound } from './api';
import type { CapturedPhoto } from './camera';
import { technicianApi } from './technician-api';
import { extensionFor, persistForQueue, uploadLocalFile } from './upload';
import { enqueueWrite, flushWriteQueue } from './write-queue';
import type { AttachmentKind } from './write-queue-core';

export type AttachResult = { status: 'uploaded'; url: string } | { status: 'queued' };

export async function attachBookingPhoto(
  bookingId: string,
  photo: CapturedPhoto,
  attachmentKind: AttachmentKind,
  caption?: string,
): Promise<AttachResult> {
  try {
    const up = await uploadLocalFile({ localUri: photo.uri, contentType: photo.contentType });
    await technicianApi.addAttachment(bookingId, {
      kind: attachmentKind,
      url: up.publicUrl,
      storageKey: up.storageKey,
      mimeType: up.contentType,
      ...(up.sizeBytes ? { sizeBytes: up.sizeBytes } : {}),
      ...(caption ? { caption } : {}),
    });
    return { status: 'uploaded', url: up.publicUrl };
  } catch (err) {
    if (!isNetworkError(err) && !isNotFound(err)) throw new Error(apiErrorMessage(err));
    const localUri = await persistForQueue(photo.uri, extensionFor(photo.contentType));
    await enqueueWrite({
      kind: 'photo.upload',
      bookingId,
      localUri,
      contentType: photo.contentType,
      attachmentKind,
      ...(caption ? { caption } : {}),
    });
    void flushWriteQueue().catch(() => undefined);
    return { status: 'queued' };
  }
}

/** Upload only (no attachment row) — used for checklist photo answers. */
export async function uploadPhotoForUrl(photo: CapturedPhoto): Promise<string> {
  const up = await uploadLocalFile({ localUri: photo.uri, contentType: photo.contentType });
  return up.publicUrl;
}
