import { nameSimilarity, normalizeName, rankDuplicates, scoreDuplicate } from '../duplicates';

const base = { id: 'c1', phone: '+919876543210', email: 'a@x.com', fullName: 'Priya Sharma', pincodes: ['560001'] };

describe('normalizeName', () => {
  it('drops honorifics, punctuation and case', () => {
    expect(normalizeName('Mrs. PRIYA  Sharma')).toBe('priya sharma');
  });
});

describe('nameSimilarity', () => {
  it('is 1 for reordered tokens', () => {
    expect(nameSimilarity('Sharma Priya', 'priya sharma')).toBe(1);
  });
  it('is high for small typos and low for different names', () => {
    expect(nameSimilarity('Priya Sharma', 'Priya Sharmaa')).toBeGreaterThan(0.6);
    expect(nameSimilarity('Priya Sharma', 'Rahul Verma')).toBeLessThan(0.3);
  });
  it('is 0 for empty input', () => {
    expect(nameSimilarity('', 'x')).toBe(0);
  });
});

describe('scoreDuplicate', () => {
  it('matches phone across prefix spellings', () => {
    const m = scoreDuplicate({ phone: '09876543210' }, base);
    expect(m?.reasons).toEqual(['phone']);
  });
  it('matches email case-insensitively', () => {
    expect(scoreDuplicate({ email: 'A@X.COM' }, base)?.reasons).toEqual(['email']);
  });
  it('matches fuzzy name within the same pincode', () => {
    const m = scoreDuplicate({ fullName: 'Priya Sharmaa', pincodes: ['560001'] }, base);
    expect(m?.reasons).toEqual(['name_pincode']);
  });
  it('does not match a fuzzy name in another pincode', () => {
    expect(scoreDuplicate({ fullName: 'Priya Sharmaa', pincodes: ['400001'] }, base)).toBeNull();
  });
  it('returns null when nothing matches', () => {
    expect(scoreDuplicate({ phone: '+919000000000', fullName: 'Rahul' }, base)).toBeNull();
  });
});

describe('rankDuplicates', () => {
  it('excludes the probe id and sorts by score', () => {
    const res = rankDuplicates(
      { phone: '+919876543210', email: 'a@x.com' },
      [
        base,
        { ...base, id: 'c2', email: null },
        { ...base, id: 'self' },
      ],
      'self',
    );
    expect(res.map((r) => r.id)).toEqual(['c1', 'c2']);
    expect(res[0]!.score).toBeGreaterThan(res[1]!.score);
  });
});
