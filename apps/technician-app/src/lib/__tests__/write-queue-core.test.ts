import { describe, expect, it } from 'vitest';

import { storageKeyFromPresign } from '../upload-key';
import {
  appendWrite,
  classifyFailure,
  MAX_WRITE_ATTEMPTS,
  MAX_WRITE_QUEUE,
  type QueuedWrite,
  withoutJobCardPatch,
} from '../write-queue-core';

const meta = (n: number) => ({ id: `w${n}`, now: '2026-10-17T00:00:00Z' });

describe('write queue core', () => {
  it('coalesces job-card patches per booking', () => {
    let q: QueuedWrite[] = [];
    q = appendWrite(q, { kind: 'jobcard.patch', bookingId: 'b1', patch: { diagnosis: 'a' } }, meta(1));
    q = appendWrite(q, { kind: 'jobcard.patch', bookingId: 'b2', patch: { diagnosis: 'x' } }, meta(2));
    q = appendWrite(q, { kind: 'jobcard.patch', bookingId: 'b1', patch: { resolution: 'b' } }, meta(3));
    expect(q).toHaveLength(2);
    expect(q[0]).toMatchObject({ id: 'w1', patch: { diagnosis: 'a', resolution: 'b' } });
    expect(withoutJobCardPatch(q, 'b1').map((w) => w.bookingId)).toEqual(['b2']);
  });

  it('keeps only the latest signature per booking but every photo', () => {
    let q: QueuedWrite[] = [];
    q = appendWrite(q, { kind: 'signature.upload', bookingId: 'b1', localUri: 'f1' }, meta(1));
    q = appendWrite(q, { kind: 'signature.upload', bookingId: 'b1', localUri: 'f2' }, meta(2));
    const photo = { kind: 'photo.upload', bookingId: 'b1', localUri: 'p', contentType: 'image/jpeg', attachmentKind: 'PARTS_PHOTO' } as const;
    q = appendWrite(q, photo, meta(3));
    q = appendWrite(q, photo, meta(4));
    expect(q.map((w) => w.id)).toEqual(['w2', 'w3', 'w4']);
  });

  it('caps the queue size', () => {
    let q: QueuedWrite[] = [];
    for (let i = 0; i < MAX_WRITE_QUEUE + 5; i += 1) {
      q = appendWrite(q, { kind: 'signature.upload', bookingId: `b${i}`, localUri: 'f' }, meta(i));
    }
    expect(q).toHaveLength(MAX_WRITE_QUEUE);
    expect(q[0]?.id).toBe('w5');
  });

  it('classifies failures', () => {
    expect(classifyFailure(null, 10)).toBe('retry-later');
    expect(classifyFailure(404, 10)).toBe('retry-later');
    expect(classifyFailure(500, 0)).toBe('retry-later');
    expect(classifyFailure(400, MAX_WRITE_ATTEMPTS - 1)).toBe('failed');
  });

  it('derives a storage key from the presign response', () => {
    expect(storageKeyFromPresign({ publicUrl: 'https://cdn.x/a/b%20c.jpg?sig=1' })).toBe('a/b c.jpg');
    expect(storageKeyFromPresign({ publicUrl: 'https://cdn.x/a.jpg', key: 'k/1.jpg' })).toBe('k/1.jpg');
  });
});
