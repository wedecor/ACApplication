import type { Metadata } from 'next';

import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { siteConfig } from '@/env';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Terms of Service',
  description: `The legal terms governing your use of ${siteConfig.name} services.`,
  path: '/terms',
});

export default function TermsPage() {
  return (
    <>
      <Breadcrumbs items={[{ name: 'Home', href: '/' }, { name: 'Terms', href: '/terms' }]} />
      <article className="prose prose-neutral mx-auto max-w-3xl px-4 py-12 dark:prose-invert sm:px-6">
        <h1>Terms of Service</h1>
        <p>
          Placeholder T&amp;Cs. Replace with final legal copy before launch. Sections to include:
          eligibility, booking & cancellation, payment & refunds, 30-day workmanship warranty,
          parts warranty, dispute resolution, governing law.
        </p>
      </article>
    </>
  );
}
