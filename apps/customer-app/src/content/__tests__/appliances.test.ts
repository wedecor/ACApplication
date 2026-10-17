import { APPLIANCE_CATEGORY_OPTIONS, APPLIANCES, getAppliance, getApplianceByCategory, getIssue } from '../appliances';

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

  it('uses server ServiceCategory values and lists the new categories', () => {
    const cats = APPLIANCES.map((a) => a.category);
    for (const c of ['TELEVISION', 'WATER_PURIFIER', 'DISHWASHER', 'AIR_COOLER', 'INVERTER_UPS', 'CEILING_FAN', 'OVEN', 'VACUUM_CLEANER', 'ELECTRICAL_WIRING']) {
      expect(cats).toContain(c);
    }
    expect(cats.some((c) => c.endsWith('_REPAIR') && c !== 'AC_REPAIR')).toBe(false);
    expect(new Set(APPLIANCES.map((a) => a.id)).size).toBe(APPLIANCES.length);
  });

  it('maps categories back to catalogue entries', () => {
    expect(getApplianceByCategory('AC_SERVICING')?.id).toBe('ac');
    expect(getApplianceByCategory('TELEVISION')?.id).toBe('tv');
    expect(APPLIANCE_CATEGORY_OPTIONS.at(-1)?.category).toBe('OTHER');
  });
});
