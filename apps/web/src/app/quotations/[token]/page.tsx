import type { Metadata } from 'next';

import { QuotationApproval } from '@/components/quotation/quotation-approval';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Your repair quotation',
  description: 'Review the quotation from your technician and approve or decline it.',
  path: '/quotations',
  noindex: true,
});

interface PageProps {
  params: Promise<{ token: string }>;
}

/** Customer approval page — the link a technician shares after building an on-site quote. */
export default async function QuotationPage({ params }: PageProps) {
  const { token } = await params;
  return <QuotationApproval token={token} />;
}
