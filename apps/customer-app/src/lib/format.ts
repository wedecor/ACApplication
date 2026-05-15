/** Common formatters used across customer-app screens. */

export function formatRupees(minor: number | null | undefined, opts: { showSign?: boolean } = {}): string {
  if (minor == null) return '\u20B9 \u2014';
  const rupees = minor / 100;
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  });
  const formatted = formatter.format(Math.abs(rupees));
  if (opts.showSign) {
    return rupees < 0 ? `\u2212${formatted}` : `+${formatted}`;
  }
  return rupees < 0 ? `\u2212${formatted}` : formatted;
}

export function formatRupeesShort(minor: number | null | undefined): string {
  if (minor == null) return '\u20B9 \u2014';
  const rupees = minor / 100;
  if (Math.abs(rupees) >= 100_000) {
    return `\u20B9${(rupees / 100_000).toFixed(1)}L`;
  }
  if (Math.abs(rupees) >= 1_000) {
    return `\u20B9${(rupees / 1_000).toFixed(rupees % 1_000 === 0 ? 0 : 1)}k`;
  }
  return `\u20B9${Math.round(rupees)}`;
}

export function formatRelative(iso: string | Date | null | undefined): string {
  if (!iso) return '\u2014';
  const target = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(target.getTime())) return '\u2014';
  const diffMs = target.getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const sign = diffMs >= 0 ? 1 : -1;
  const minutes = abs / 60_000;
  if (minutes < 1) return sign > 0 ? 'in a moment' : 'just now';
  if (minutes < 60) {
    const m = Math.round(minutes);
    return sign > 0 ? `in ${m} min` : `${m} min ago`;
  }
  const hours = minutes / 60;
  if (hours < 24) {
    const h = Math.round(hours);
    return sign > 0 ? `in ${h}h` : `${h}h ago`;
  }
  const days = hours / 24;
  if (days < 7) {
    const d = Math.round(days);
    return sign > 0 ? `in ${d}d` : `${d}d ago`;
  }
  return target.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function formatDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return '\u2014';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '\u2014';
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(iso: string | Date | null | undefined): string {
  if (!iso) return '\u2014';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '\u2014';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function maskPhone(phone: string): string {
  const trimmed = phone.replace(/\s+/g, '');
  if (trimmed.length < 6) return trimmed;
  return `${trimmed.slice(0, 3)}\u00B7\u00B7\u00B7\u00B7${trimmed.slice(-3)}`;
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
