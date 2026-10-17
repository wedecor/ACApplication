import { computeWarrantyStatus, warrantyLabel, warrantyTone } from '../warranty';

describe('warranty helpers', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  it('computes status from the latest date', () => {
    expect(computeWarrantyStatus([null], now)).toEqual({ status: 'UNKNOWN', daysLeft: null });
    expect(computeWarrantyStatus(['2027-01-01T00:00:00Z'], now).status).toBe('IN_WARRANTY');
    expect(computeWarrantyStatus(['2026-01-10T00:00:00Z'], now)).toEqual({ status: 'EXPIRING_SOON', daysLeft: 9 });
    expect(computeWarrantyStatus(['2025-06-01T00:00:00Z', '2025-12-01T00:00:00Z'], now).status).toBe('EXPIRED');
  });
  it('labels and tones', () => {
    expect(warrantyLabel('EXPIRING_SOON', 1)).toBe('Expires in 1 day');
    expect(warrantyLabel('IN_WARRANTY', 100)).toBe('In warranty');
    expect(warrantyTone('EXPIRED')).toBe('danger');
  });
});
