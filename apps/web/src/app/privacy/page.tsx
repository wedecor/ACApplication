import type { Metadata } from 'next';

import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { siteConfig } from '@/env';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Privacy Policy',
  description: `How ${siteConfig.name} collects, uses and protects your personal data.`,
  path: '/privacy',
  noindex: false,
});

export default function PrivacyPage() {
  return (
    <>
      <Breadcrumbs items={[{ name: 'Home', href: '/' }, { name: 'Privacy', href: '/privacy' }]} />
      <article className="prose prose-neutral mx-auto max-w-3xl px-4 py-12 dark:prose-invert sm:px-6">
        <h1>Privacy Policy</h1>
        <p>
          This is a placeholder privacy policy. Replace with your final legal copy before
          launch. Your version should cover, at minimum:
        </p>
        <ul>
          <li>What personal data we collect (name, phone, address, location, payment).</li>
          <li>Why we collect it (booking, dispatch, billing, support).</li>
          <li>How long we retain it.</li>
          <li>Third-party processors (payment gateway, WhatsApp BSP, SMS gateway, analytics).</li>
          <li>Your rights (access, rectification, erasure, withdrawal of consent).</li>
          <li>Contact: {siteConfig.supportEmail}.</li>
        </ul>
      </article>
    </>
  );
}
