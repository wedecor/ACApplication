import { siteConfig } from '@/env';

/**
 * Build a `wa.me` deep-link with pre-filled message text.
 *
 * `wa.me` accepts: `wa.me/<phone>?text=<urlencoded message>` — phone
 * must be digits only, no `+`.
 */
export function buildWhatsAppLink(opts: {
  /** Override the destination number (defaults to support line). */
  number?: string;
  /** Pre-filled message text. */
  message: string;
}): string {
  const phone = (opts.number ?? siteConfig.whatsappNumber).replace(/[^\d]/g, '');
  const text = encodeURIComponent(opts.message);
  return `https://wa.me/${phone}?text=${text}`;
}

/**
 * Contextual message templates. These should read like a real customer
 * typed them — over-templated "marketing" copy hurts trust.
 */
export const WhatsAppTemplates = {
  general: () => 'Hi! I would like to book a service. Please help.',

  service: (service: { name: string }) =>
    `Hi! I need help with ${service.name}. Can you share availability today?`,

  emergency: (service?: { name: string } | null) =>
    `Hi! I have an emergency — ${
      service?.name ?? 'a home appliance issue'
    }. Can you send a technician as soon as possible?`,

  city: (city: { name: string }, service?: { name: string } | null) =>
    `Hi! I'm in ${city.name} and need ${service?.name ?? 'a service'}. Please share next available slot.`,

  brand: (brand: { name: string }, service?: { name: string } | null) =>
    `Hi! I have a ${brand.name} appliance${
      service ? ` and need ${service.name}` : ''
    }. Please share pricing and availability.`,

  bookingFollowup: (leadCode: string) =>
    `Hi! Following up on booking ${leadCode}. Could you share an ETA?`,

  callback: (name: string) =>
    `Hi! I'm ${name} and would like a call-back about a service.`,
} as const;
