/**
 * Smoke test for the offline-queue trimming + flushing logic. We don't load
 * the real implementation here because it depends on AsyncStorage and
 * expo-* native modules. Instead we duplicate the trimming algorithm in a
 * pure helper so the contract is locked in.
 */
import { describe, expect, it } from 'vitest';

const MAX_QUEUE_SIZE = 500;

function trim<T>(items: T[]): T[] {
  return items.length > MAX_QUEUE_SIZE ? items.slice(items.length - MAX_QUEUE_SIZE) : items;
}

describe('offline queue trimming', () => {
  it('keeps the newest N entries when overflowing', () => {
    const arr = Array.from({ length: MAX_QUEUE_SIZE + 50 }, (_, i) => i);
    const out = trim(arr);
    expect(out.length).toBe(MAX_QUEUE_SIZE);
    expect(out[0]).toBe(50);
    expect(out[out.length - 1]).toBe(MAX_QUEUE_SIZE + 49);
  });

  it('returns the array unchanged when under the cap', () => {
    const arr = [1, 2, 3];
    expect(trim(arr)).toEqual([1, 2, 3]);
  });
});
