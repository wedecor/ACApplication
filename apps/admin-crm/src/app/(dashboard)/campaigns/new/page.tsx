'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { CampaignEditor } from '@/components/growth/campaign-editor';

export default function NewCampaignPage() {
  return (
    <div className="space-y-4">
      <header>
        <Link
          href="/campaigns"
          className="-ml-2 inline-flex h-10 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden /> Campaigns
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">New campaign</h1>
      </header>
      <CampaignEditor />
    </div>
  );
}
