'use client';

import Link from 'next/link';

import { CampaignEditor } from '@/components/growth/campaign-editor';

export default function NewCampaignPage() {
  return (
    <div className="space-y-4">
      <header>
        <Link href="/campaigns" className="text-sm text-muted-foreground hover:underline">
          ← Campaigns
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">New campaign</h1>
      </header>
      <CampaignEditor />
    </div>
  );
}
