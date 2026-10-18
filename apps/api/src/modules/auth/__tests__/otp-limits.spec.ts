import { HttpException } from '@nestjs/common';

import { OtpService } from '../otp.service';

/** Minimal in-memory Redis with the commands OtpService uses (TTL ignored). */
function fakeRedis() {
  const store = new Map<string, string>();
  return {
    store,
    default: {
      get: jest.fn(async (k: string) => store.get(k) ?? null),
      set: jest.fn(async (k: string, v: string) => {
        store.set(k, v);
        return 'OK';
      }),
      del: jest.fn(async (...keys: string[]) => {
        keys.forEach((k) => store.delete(k));
        return keys.length;
      }),
      incr: jest.fn(async (k: string) => {
        const n = Number(store.get(k) ?? 0) + 1;
        store.set(k, String(n));
        return n;
      }),
      expire: jest.fn(async () => 1),
    },
  };
}

const env = {
  OTP_LENGTH: 6,
  OTP_TTL_SECONDS: 300,
  OTP_MAX_ATTEMPTS: 5,
  OTP_ISSUE_LIMIT: 3,
  OTP_LOCK_WINDOW_SECONDS: 900,
  JWT_SECRET: 'test-secret-that-is-long-enough-000000',
};

function build() {
  const redis = fakeRedis();
  return { svc: new OtpService(redis as never, env as never), redis };
}

describe('OtpService limits', () => {
  it('accepts the right code once', async () => {
    const { svc } = build();
    const { code } = await svc.issue('+911');
    await expect(svc.verify('+911', code)).resolves.toBe(true);
    await expect(svc.verify('+911', code)).resolves.toBe(false);
  });

  it('caps parallel guesses at OTP_MAX_ATTEMPTS, even if one of them is right', async () => {
    const { svc } = build();
    const { code } = await svc.issue('+912');
    const wrong = code === '000000' ? '111111' : '000000';
    const results = await Promise.all([
      ...Array.from({ length: 5 }, () => svc.verify('+912', wrong)),
      svc.verify('+912', code),
    ]);
    expect(results.filter(Boolean)).toHaveLength(0);
  });

  it('does not reset failed attempts when a new code is issued', async () => {
    const { svc } = build();
    const first = await svc.issue('+913');
    for (let i = 0; i < 5; i += 1) await svc.verify('+913', first.code === '000000' ? '111111' : '000000');
    const second = await svc.issue('+913');
    await expect(svc.verify('+913', second.code)).resolves.toBe(false);
  });

  it('limits how many codes one destination can request per window', async () => {
    const { svc } = build();
    for (let i = 0; i < 3; i += 1) await svc.issue('+914');
    await expect(svc.issue('+914')).rejects.toBeInstanceOf(HttpException);
  });

  it('binds the code to its purpose and gives each issue its own id', async () => {
    const { svc } = build();
    const a = await svc.issue('+915', 'PHONE_CHANGE');
    await expect(svc.verify('+915', a.code, 'LOGIN')).resolves.toBe(false);
    const b = await svc.issue('+916');
    expect(b.issueId).not.toBe(a.issueId);
  });
});
