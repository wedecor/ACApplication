import { APPLIANCES, getAppliance, getIssue } from '../appliances';

describe('appliances catalogue', () => {
  it('has at least one bookable issue per appliance', () => {
    for (const a of APPLIANCES) {
      expect(a.issues.length).toBeGreaterThan(0);
    }
  });

  it('looks up appliances by id', () => {
    expect(getAppliance('ac')?.name).toBe('Air Conditioner');
    expect(getAppliance('unknown')).toBeUndefined();
  });

  it('looks up issues by appliance + id', () => {
    expect(getIssue('ac', 'no-cooling')?.label).toMatch(/cooling/i);
    expect(getIssue('ac', 'unknown')).toBeUndefined();
  });

  it('exposes a positive starting price for every appliance', () => {
    for (const a of APPLIANCES) {
      expect(a.estStartingMinor).toBeGreaterThan(0);
      expect(a.visitMinutes).toBeGreaterThan(0);
    }
  });
});
