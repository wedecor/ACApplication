import { validateRegistry } from './validate';

describe('validateRegistry', () => {
  it('passes for the canonical seed registry', () => {
    const result = validateRegistry();
    expect(result.valid).toBe(true);
    expect(result.duplicatePermissionKeys).toEqual([]);
    expect(result.unknownRolePermissionKeys).toEqual([]);
  });
});
