/**
 * Query-string coercion helpers for class-transformer `@Transform`.
 * `?status=OPEN` arrives as a string; `?status=OPEN&status=PENDING` or
 * `?status=OPEN,PENDING` as a list — normalise all of them to an array.
 */
export function toArray(value: unknown): unknown {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(',').map((s) => s.trim()).filter(Boolean);
  return value;
}
