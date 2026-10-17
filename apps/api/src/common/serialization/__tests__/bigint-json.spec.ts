import { bigintToJson, installBigIntJson } from '../bigint-json';

describe('bigint JSON serialisation', () => {
  it('serialises safe integers as numbers', () => {
    expect(bigintToJson(BigInt(70_682))).toBe(70_682);
  });

  it('keeps precision for values beyond Number.MAX_SAFE_INTEGER', () => {
    expect(bigintToJson(BigInt('9007199254740993'))).toBe('9007199254740993');
  });

  it('lets JSON.stringify handle Prisma BigInt fields once installed', () => {
    installBigIntJson();
    expect(JSON.stringify({ lifetimeValueMinor: BigInt(1250) })).toBe('{"lifetimeValueMinor":1250}');
  });
});
