import { MessageCircle, Phone } from 'lucide-react';

import { Button } from '@ac/ui';

/** Call / WhatsApp shortcuts for a phone number (tel: and wa.me links). */
export function ContactButtons({ phone, whatsapp }: { phone: string; whatsapp?: string | null }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild size="sm" variant="outline">
        <a href={`tel:${phone}`}>
          <Phone aria-hidden /> Call
        </a>
      </Button>
      <Button asChild size="sm" variant="outline">
        <a href={`https://wa.me/${(whatsapp ?? phone).replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
          <MessageCircle aria-hidden /> WhatsApp
        </a>
      </Button>
    </div>
  );
}
