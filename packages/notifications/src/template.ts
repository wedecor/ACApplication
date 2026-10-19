/**
 * Simple `{{variable}}` substitution for notification templates.
 */
export function renderTemplate(
  body: string,
  data: Record<string, unknown> = {},
): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = data[key];
    if (value === undefined || value === null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return value.toString();
    return JSON.stringify(value) ?? '';
  });
}
