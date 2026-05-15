import { deriveTenantBarcode, makeEan13 } from '../codes';

describe('makeEan13', () => {
  it('appends the correct EAN-13 checksum digit', () => {
    // Known sample: base 590123412345 → checksum 7 → 5901234123457.
    expect(makeEan13('590123412345')).toBe('5901234123457');
  });

  it('rejects bases that are not exactly 12 digits', () => {
    expect(() => makeEan13('abc')).toThrow(/12 digits/);
    expect(() => makeEan13('1234567890')).toThrow(/12 digits/);
    expect(() => makeEan13('1234567890123')).toThrow(/12 digits/);
  });

  it('produces a 13-digit barcode', () => {
    const barcode = makeEan13('209012345678');
    expect(barcode).toHaveLength(13);
    expect(/^\d{13}$/.test(barcode)).toBe(true);
  });
});

describe('deriveTenantBarcode', () => {
  it('is deterministic for a (tenant, item) pair', () => {
    const a = deriveTenantBarcode('tenant_1', 'item_42');
    const b = deriveTenantBarcode('tenant_1', 'item_42');
    expect(a).toBe(b);
  });

  it('produces distinct barcodes for distinct items', () => {
    const a = deriveTenantBarcode('tenant_1', 'item_42');
    const b = deriveTenantBarcode('tenant_1', 'item_43');
    expect(a).not.toBe(b);
  });

  it('produces a valid 13-digit EAN code with the 209 prefix by default', () => {
    const barcode = deriveTenantBarcode('tenant_1', 'item_42');
    expect(/^209\d{10}$/.test(barcode)).toBe(true);
  });
});
