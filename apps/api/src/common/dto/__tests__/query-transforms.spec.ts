import { toArray } from '../query-transforms';

describe('toArray', () => {
  it('wraps a single query value', () => {
    expect(toArray('OPEN')).toEqual(['OPEN']);
  });

  it('splits comma lists and keeps arrays', () => {
    expect(toArray('OPEN, PENDING')).toEqual(['OPEN', 'PENDING']);
    expect(toArray(['OPEN'])).toEqual(['OPEN']);
  });

  it('leaves other values alone', () => {
    expect(toArray(undefined)).toBeUndefined();
  });
});
