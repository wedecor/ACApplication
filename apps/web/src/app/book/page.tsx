import type { Metadata } from 'next';
import { Suspense } from 'react';

import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { BookingForm } from '@/components/booking/booking-form';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Book a Home Appliance Repair',
  description:
    'Book an AC, fridge, washing machine, microwave or chimney repair in 60 seconds. Verified technicians, transparent quote on WhatsApp, 30-day warranty.',
  path: '/book',
  noindex: false,
});

export default function BookPage() {
  return (
    <>
      <Breadcrumbs items={[{ name: 'Home', href: '/' }, { name: 'Book a service', href: '/book' }]} />
      {/* Each step's <legend> is styled as the visible title; this gives the page its document heading. */}
      <h1 className="sr-only">Book an appliance repair</h1>
      <Suspense fallback={<div className="min-h-[60vh]" />}>
        <BookingForm />
      </Suspense>
    </>
  );
}
