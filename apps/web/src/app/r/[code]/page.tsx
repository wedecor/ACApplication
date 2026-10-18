import { Button } from '@ac/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

import { siteConfig } from '@/env';
import { normaliseReferralCode } from '@/lib/routes';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'You’ve been invited',
  description: 'A friend shared their referral code for home appliance repair.',
  path: '/r',
  noindex: true,
});

interface PageProps {
  params: Promise<{ code: string }>;
}

/** Landing page for the share link from the customer app's "Refer & earn" screen. */
export default async function ReferralPage({ params }: PageProps) {
  const { code: raw } = await params;
  const code = normaliseReferralCode(raw);
  const bookHref = code
    ? `/book?utm_source=referral&utm_medium=share&utm_campaign=${encodeURIComponent(code)}`
    : '/book';

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:px-6 sm:py-16">
      <h1 className="text-balance text-3xl font-bold tracking-tight">A friend invited you to {siteConfig.name}</h1>
      {code ? (
        <>
          <div className="mt-6 rounded-lg border bg-card p-5">
            <p className="text-sm text-muted-foreground">Their referral code</p>
            <p className="mt-1 font-mono text-3xl font-bold tracking-widest">{code}</p>
          </div>
          <ol className="mt-6 list-decimal space-y-3 pl-5 text-muted-foreground marker:font-semibold marker:text-foreground">
            <li>Book your first repair. We’ll note the code on your booking.</li>
            <li>
              In the app, open <span className="font-medium text-foreground">Account → Refer &amp; earn</span> and enter
              the code before your first job is completed.
            </li>
          </ol>
        </>
      ) : (
        <p className="mt-4 text-muted-foreground">
          This invite link looks incomplete. You can still book a repair, then ask your friend for their code.
        </p>
      )}
      <Button asChild size="lg" fullWidth className="mt-8">
        <Link href={bookHref}>Book a repair</Link>
      </Button>
    </div>
  );
}
