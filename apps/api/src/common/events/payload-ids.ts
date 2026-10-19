/** A payload field as an id string (strings and numbers only), else null. */
export function payloadId(value: unknown): string | null {
  if (typeof value === 'string' && value) return value;
  if (typeof value === 'number' || typeof value === 'bigint') return value.toString();
  return null;
}
