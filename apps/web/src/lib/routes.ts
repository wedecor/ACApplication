/**
 * Pages where the visitor is finishing a task we sent them (e.g. approving a
 * quotation, rating a visit), so marketing overlays — sticky "Book now" bar, exit-intent
 * sheet — would cover the controls and pull them away.
 */
export function isTaskPage(pathname: string | null): boolean {
  return pathname ? ['/quotations/', '/rate/'].some((p) => pathname.startsWith(p)) : false;
}

/** Referral codes are short uppercase alphanumerics; anything else is ignored. */
export function normaliseReferralCode(raw: string): string | null {
  const code = decodeURIComponent(raw).trim().toUpperCase();
  return /^[A-Z0-9]{3,20}$/.test(code) ? code : null;
}
