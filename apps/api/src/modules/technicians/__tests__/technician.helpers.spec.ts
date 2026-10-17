import {
  buildFullName,
  computeCompletionRate,
  formatEmployeeCode,
  validateWorkingHours,
} from '../technician.helpers';

describe('technician helpers', () => {
  describe('formatEmployeeCode', () => {
    it('zero-pads to five digits', () => {
      expect(formatEmployeeCode(1)).toBe('TECH-00001');
      expect(formatEmployeeCode(123456)).toBe('TECH-123456');
    });

    it('rejects non-positive sequences', () => {
      expect(() => formatEmployeeCode(0)).toThrow(RangeError);
      expect(() => formatEmployeeCode(1.5)).toThrow(RangeError);
    });
  });

  describe('validateWorkingHours', () => {
    it('accepts a well-formed schedule', () => {
      expect(
        validateWorkingHours({ mon: [['09:00', '13:00'], ['14:00', '18:00']], sun: [] }),
      ).toEqual([]);
    });

    it('rejects unknown days, malformed and inverted windows', () => {
      const errors = validateWorkingHours({
        funday: [],
        mon: [['9am', '5pm']],
        tue: [['18:00', '09:00']],
      });
      expect(errors).toHaveLength(3);
    });

    it('detects overlapping windows', () => {
      expect(validateWorkingHours({ wed: [['09:00', '12:00'], ['11:00', '15:00']] })).toEqual([
        'wed has overlapping windows',
      ]);
    });

    it('rejects non-object values', () => {
      expect(validateWorkingHours([])).toHaveLength(1);
      expect(validateWorkingHours(null)).toHaveLength(1);
    });
  });

  describe('computeCompletionRate', () => {
    it('uses the fallback when nothing has finished', () => {
      expect(computeCompletionRate({ completed: 0, cancelled: 0, noShow: 0 }, 0.9)).toBe(0.9);
    });

    it('computes completed / finished', () => {
      expect(computeCompletionRate({ completed: 3, cancelled: 1, noShow: 0 }, 1)).toBe(0.75);
    });
  });

  it('buildFullName trims and skips empty last names', () => {
    expect(buildFullName(' Ravi ', ' Kumar ')).toBe('Ravi Kumar');
    expect(buildFullName('Ravi', null)).toBe('Ravi');
  });
});
