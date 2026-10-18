import type { Metadata } from 'next';

import { RateVisit } from '@/components/rating/rate-visit';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Rate your visit',
  description: 'Tell us how your technician did.',
  path: '/rate',
  noindex: true,
});

interface PageProps {
  params: Promise<{ token: string }>;
}

/** Linked from the review request sent after a completed visit. */
export default async function RatePage({ params }: PageProps) {
  const { token } = await params;
  return <RateVisit token={token} />;
}
