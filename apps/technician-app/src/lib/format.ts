/** Display helpers shared by the field screens. Pure, so they're unit-tested. */

const JOB_STATUS_LABEL: Record<string, string> = {
  TECHNICIAN_EN_ROUTE: 'On the way',
  WAITING_PARTS: 'Waiting for parts',
  NO_SHOW: 'No-show',
};

/** `IN_PROGRESS` → "In progress"; a few booking states get friendlier wording. */
export function humanizeStatus(status: string): string {
  const known = JOB_STATUS_LABEL[status];
  if (known) return known;
  const words = status.toLowerCase().replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * "Sat 12 Oct · 14:00–16:00" when a slot is booked, otherwise the exact time.
 * Formatted in the device's locale/time zone.
 */
export function formatJobWhen(scheduledAt: string, slot?: string | null): string {
  const d = new Date(scheduledAt);
  if (Number.isNaN(d.getTime())) return slot ?? '';
  const day = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  if (slot) return `${day} · ${slot.replace('-', '–')}`;
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${day} · ${time}`;
}

/** "4 Nov 2026" in the device's time zone; "—" when missing. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "+919000001028" → "+91 90000 01028"; anything else is returned untouched. */
export function formatPhone(phone: string): string {
  const m = /^\+91(\d{5})(\d{5})$/.exec(phone);
  return m ? `+91 ${m[1]} ${m[2]}` : phone;
}
