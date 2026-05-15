import { validateRegistry } from '@ac/auth';

describe('RbacService registry', () => {
  it('registry is valid before any DB operation', () => {
    const result = validateRegistry();
    expect(result.valid).toBe(true);
  });
});
