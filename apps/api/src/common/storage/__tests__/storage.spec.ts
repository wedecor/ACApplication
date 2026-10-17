import { BadRequestException, PayloadTooLargeException, ServiceUnavailableException } from '@nestjs/common';

import { presignUrl } from '../sigv4';
import { StorageService, type StorageEnv } from '../storage.service';
import { assertUploadAllowed, buildObjectKey } from '../upload-policy';

describe('sigv4.presignUrl', () => {
  it('matches the AWS reference vector for a presigned GET', () => {
    // https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html
    const url = presignUrl({
      method: 'GET',
      protocol: 'https:',
      host: 'examplebucket.s3.amazonaws.com',
      path: '/test.txt',
      region: 'us-east-1',
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      expiresInSeconds: 86400,
      now: new Date('2013-05-24T00:00:00Z'),
    });
    expect(url).toContain('X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request');
    expect(url).toContain(
      'X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404',
    );
  });

  it('signs extra headers (content-type) into SignedHeaders', () => {
    const url = presignUrl({
      method: 'PUT',
      protocol: 'http:',
      host: 'localhost:9000',
      path: '/bucket/a b.png',
      region: 'us-east-1',
      accessKeyId: 'k',
      secretAccessKey: 's',
      expiresInSeconds: 60,
      signedHeaders: { 'Content-Type': 'image/png' },
    });
    expect(url.startsWith('http://localhost:9000/bucket/a%20b.png?')).toBe(true);
    expect(url).toContain('X-Amz-SignedHeaders=content-type%3Bhost');
  });
});

describe('upload policy', () => {
  it('accepts images and pdf, normalising case', () => {
    expect(assertUploadAllowed({ filename: 'a.JPG', contentType: 'Image/JPEG' }, 1000)).toBe('image/jpeg');
    expect(assertUploadAllowed({ filename: 'a.pdf', contentType: 'application/pdf' }, 1000)).toBe(
      'application/pdf',
    );
  });

  it('rejects other content types', () => {
    expect(() => assertUploadAllowed({ filename: 'a.exe', contentType: 'application/x-msdownload' }, 1000)).toThrow(
      BadRequestException,
    );
    expect(() => assertUploadAllowed({ filename: 'a.svg', contentType: 'image/svg+xml' }, 1000)).toThrow(
      BadRequestException,
    );
  });

  it('caps the declared size', () => {
    expect(() =>
      assertUploadAllowed({ filename: 'a.png', contentType: 'image/png', sizeBytes: 2000 }, 1000),
    ).toThrow(PayloadTooLargeException);
  });

  it('builds a tenant-scoped key with an extension derived from the content type', () => {
    const key = buildObjectKey({
      tenantId: 'tenant1',
      scope: 'customer',
      filename: '../../etc/Evil File.php',
      contentType: 'image/png',
      id: 'uuid',
      now: new Date('2026-03-04T00:00:00Z'),
    });
    expect(key).toBe('tenant1/customer/2026/03/uuid-etc-evil-file.png');
  });
});

describe('StorageService', () => {
  const env: StorageEnv = {
    S3_ENDPOINT: 'http://localhost:9000',
    S3_REGION: 'ap-south-1',
    S3_BUCKET: 'ac-media',
    S3_ACCESS_KEY_ID: 'minioadmin',
    S3_SECRET_ACCESS_KEY: 'minioadmin',
    S3_PUBLIC_URL: undefined,
    S3_FORCE_PATH_STYLE: true,
    UPLOAD_MAX_BYTES: 5 * 1024 * 1024,
    UPLOAD_URL_TTL_SECONDS: 600,
  };

  it('issues a path-style presigned PUT and public URL', () => {
    const svc = new StorageService(env);
    const res = svc.presignUpload({
      tenantId: 't1',
      scope: 'customer',
      filename: 'photo.jpg',
      contentType: 'image/jpeg',
    });
    expect(res.uploadUrl.startsWith('http://localhost:9000/ac-media/t1/customer/')).toBe(true);
    expect(res.uploadUrl).toContain('X-Amz-Expires=600');
    expect(res.publicUrl).toBe(`http://localhost:9000/ac-media/${res.key}`);
    expect(res.headers['Content-Type']).toBe('image/jpeg');
  });

  it('uses S3_PUBLIC_URL when configured', () => {
    const svc = new StorageService({ ...env, S3_PUBLIC_URL: 'https://cdn.example.com/' });
    expect(svc.publicUrl('a/b.png')).toBe('https://cdn.example.com/a/b.png');
  });

  it('refuses to sign when credentials are missing', () => {
    const svc = new StorageService({ ...env, S3_BUCKET: undefined });
    expect(() =>
      svc.presignUpload({ tenantId: 't', scope: 's', filename: 'a.png', contentType: 'image/png' }),
    ).toThrow(ServiceUnavailableException);
  });
});
