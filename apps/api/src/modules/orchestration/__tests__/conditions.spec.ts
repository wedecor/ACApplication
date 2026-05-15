import { evaluateRuleGroup } from '@ac/workflow';

describe('evaluateRuleGroup', () => {
  it('evaluates AND conditions', () => {
    const pass = evaluateRuleGroup(
      {
        and: [
          { field: 'booking.status', op: 'eq', value: 'PENDING' },
          { field: 'booking.ageMinutes', op: 'gt', value: 15 },
        ],
      },
      { booking: { status: 'PENDING', ageMinutes: 20 } },
    );
    expect(pass).toBe(true);
  });

  it('evaluates OR conditions', () => {
    const pass = evaluateRuleGroup(
      {
        or: [
          { field: 'x', op: 'eq', value: 1 },
          { field: 'y', op: 'eq', value: 2 },
        ],
      },
      { y: 2 },
    );
    expect(pass).toBe(true);
  });
});
