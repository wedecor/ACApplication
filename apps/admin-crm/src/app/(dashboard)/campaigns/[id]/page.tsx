'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

import { CampaignEditor } from '@/components/growth/campaign-editor';

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="space-y-4">
      <header>
        <Link href="/campaigns" className="text-sm text-muted-foreground hover:underline">
          ← Campaigns
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">Campaign</h1>
      </header>
      <CampaignEditor campaignId={id} />
    </div>
  );
}
