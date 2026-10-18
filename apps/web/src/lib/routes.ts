/**
 * Pages where the visitor is finishing a task we sent them (e.g. approving a
 * quotation), so marketing overlays — sticky "Book now" bar, exit-intent
 * sheet — would cover the controls and pull them away.
 */
export function isTaskPage(pathname: string | null): boolean {
  return pathname?.startsWith('/quotations/') ?? false;
}
