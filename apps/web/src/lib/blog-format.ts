/**
 * Centralised date / number formatters for the blog. We isolate these so
 * we can later swap to a localised library (Intl + fallback) without
 * touching every page.
 */
export function formatDate(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
