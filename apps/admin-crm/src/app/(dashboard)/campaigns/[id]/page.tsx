'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { CampaignEditor } from '@/components/growth/campaign-editor';
import { useCampaign } from '@/hooks/use-growth';

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: campaign } = useCampaign(id);
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <Link
          href="/campaigns"
          className="-ml-2 inline-flex h-10 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden /> Campaigns
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{campaign?.name ?? 'Campaign'}</h1>
      </header>
      <CampaignEditor campaignId={id} />
    </div>
  );
}
