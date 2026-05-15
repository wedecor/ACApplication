import type { RuleCondition, RuleConditionGroup } from './types';

function getField(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function evalCondition(cond: RuleCondition, ctx: Record<string, unknown>): boolean {
  const actual = getField(ctx, cond.field);
  const op = cond.op ?? 'eq';
  const expected = cond.value;
  switch (op) {
    case 'eq':
      return actual === expected;
    case 'neq':
      return actual !== expected;
    case 'gt':
      return Number(actual) > Number(expected);
    case 'gte':
      return Number(actual) >= Number(expected);
    case 'lt':
      return Number(actual) < Number(expected);
    case 'lte':
      return Number(actual) <= Number(expected);
    case 'in':
      return Array.isArray(expected) && expected.includes(actual);
    case 'contains':
      return String(actual).includes(String(expected));
    default:
      return false;
  }
}

export function evaluateRuleGroup(
  group: RuleConditionGroup,
  ctx: Record<string, unknown>,
): boolean {
  if (group.and?.length) {
    return group.and.every((c) =>
      'field' in c ? evalCondition(c as RuleCondition, ctx) : evaluateRuleGroup(c, ctx),
    );
  }
  if (group.or?.length) {
    return group.or.some((c) =>
      'field' in c ? evalCondition(c as RuleCondition, ctx) : evaluateRuleGroup(c, ctx),
    );
  }
  return true;
}
