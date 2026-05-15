/**
 * Small utilities shared across pages.
 */
export function cn(...inputs: Array<string | undefined | null | false>): string {
  return inputs.filter(Boolean).join(' ');
}

/**
 * Indian-format number with thousands separator.
 *
 * `48200` → `"48,200"`. We use `en-IN` locale to get lakh/crore grouping
 * (`48,200` rather than `48200`).
 */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-IN');
}

export function formatRupees(n: number): string {
  return `₹${formatNumber(n)}`;
}

/**
 * Render an in-content `{{keyword}}` token from a search param.
 *
 * Used by Google Ads landing pages — we accept a URL parameter (`?kw=`)
 * and substitute it into the H1. We sanitise to letters / digits /
 * spaces so the URL can't inject HTML or script content.
 */
export function substituteKeyword(template: string, keyword: string | null | undefined, fallback: string): string {
  const cleaned = (keyword ?? '').replace(/[^a-zA-Z0-9\s\-&]/g, '').trim().slice(0, 60);
  const value = cleaned || fallback;
  return template.replace(/\{\{keyword\}\}/g, value);
}

/** Format a slug like `ac-repair` → `AC Repair`. */
export function humanizeSlug(slug: string): string {
  return slug
    .split('-')
    .map((s) => (s.length <= 3 ? s.toUpperCase() : s[0]!.toUpperCase() + s.slice(1)))
    .join(' ');
}

/** Returns ISO date prefix `YYYY-MM-DD` for a given Date. */
export function isoDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().slice(0, 10);
}
