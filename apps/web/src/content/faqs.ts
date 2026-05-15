/**
 * Site-wide FAQs — these are answers the customer needs on every page.
 * Service- and city-specific FAQs live in `services.ts` and are merged
 * in by `<Faq>` when those pages render.
 */
export interface Faq {
  question: string;
  answer: string;
}

export const SITE_FAQS: Faq[] = [
  {
    question: 'How quickly can a technician reach me?',
    answer:
      'In serviceable cities our median response is 60 minutes for emergency requests and 2-3 hours for standard slots. You can pick a specific 2-hour window during booking.',
  },
  {
    question: 'Do you charge a visit fee?',
    answer:
      'Yes — ₹299 for a standard diagnosis visit. If you go ahead with the repair, this ₹299 is fully adjusted into the final repair quote. Quotations are always shared on your phone before any work starts.',
  },
  {
    question: 'Are the technicians background-verified?',
    answer:
      'Every technician on the platform is background-verified, certified for the brands they service, and rated by past customers. You can see their profile and rating before they arrive.',
  },
  {
    question: 'Do you provide a warranty on repairs?',
    answer:
      'Yes — every repair carries a 30-day service warranty on labour and any parts we install. If the same issue recurs within 30 days, we revisit free of charge.',
  },
  {
    question: 'Which payment methods do you accept?',
    answer:
      'UPI, all major debit / credit cards, net banking, wallets, and cash on completion. You can also send payment via the WhatsApp payment-link we share post-service.',
  },
  {
    question: 'Can I reschedule or cancel my booking?',
    answer:
      'Yes — you can reschedule or cancel from the WhatsApp confirmation or the booking link until 30 minutes before the slot. After that, please call our support line and we will do our best.',
  },
  {
    question: 'Do you offer AMC plans?',
    answer:
      'Yes — our AMC (Annual Maintenance Contract) plans cover scheduled visits, priority dispatch and discounts on emergency repairs. You can view plans at /membership.',
  },
];
