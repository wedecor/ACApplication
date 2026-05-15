/**
 * Simple `{{variable}}` substitution for notification templates.
 */
export function renderTemplate(
  body: string,
  data: Record<string, unknown> = {},
): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = data[key];
    return value === undefined || value === null ? '' : String(value);
  });
}
