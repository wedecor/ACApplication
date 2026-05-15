import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, ShieldCheck, Sparkles, Zap } from 'lucide-react';

import { Badge, Button } from '@ac/ui';

import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { CtaBand } from '@/components/sections/cta-band';
import { Faq } from '@/components/sections/faq';
import { SITE_FAQS } from '@/content/faqs';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'AMC Membership — Annual Maintenance Plans for Home Appliances',
  description:
    'Annual maintenance contracts for AC, fridge, washing machine and chimney. Scheduled visits, priority dispatch, discounted repairs.',
  path: '/membership',
  keywords: ['amc plan', 'annual maintenance contract', 'appliance amc', 'home appliance protection'],
});

const PLANS = [
  {
    slug: 'basic',
    name: 'Basic',
    price: '₹1,999',
    cadence: 'per appliance / year',
    description: 'Annual cleaning visit + diagnostic coverage.',
    perks: [
      '1 deep-cleaning visit per year',
      '24×7 phone support',
      '10% off repairs',
      '₹199 visit fee (vs ₹299)',
    ],
    badge: null,
  },
  {
    slug: 'standard',
    name: 'Standard',
    price: '₹2,999',
    cadence: 'per appliance / year',
    description: 'Two visits + parts discount + priority dispatch.',
    perks: [
      '2 service visits per year',
      'Priority dispatch (within 90 min)',
      '15% off repairs',
      'Free visit fee — diagnosis included',
      'Coverage for genuine spare parts',
    ],
    badge: 'Most popular',
  },
  {
    slug: 'premium',
    name: 'Premium',
    price: '₹4,999',
    cadence: 'per appliance / year',
    description: 'Concierge support, unlimited diagnostics, parts discount.',
    perks: [
      '4 service visits per year',
      'Priority dispatch (within 60 min)',
      '25% off repairs',
      'Unlimited free diagnostics',
      '15% off genuine spare parts',
      'Annual deep-clean + chemical wash',
    ],
    badge: 'Best value',
  },
];

export default function MembershipPage() {
  return (
    <>
      <Breadcrumbs items={[{ name: 'Home', href: '/' }, { name: 'AMC Membership', href: '/membership' }]} />
      <header className="border-b border-border bg-muted/20">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16 text-center">
          <Badge variant="muted">AMC Plans</Badge>
          <h1 className="mx-auto mt-3 max-w-2xl text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            Worry-free appliances all year, for one fixed price.
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-balance text-base text-muted-foreground sm:text-lg">
            Scheduled service visits, priority technician dispatch, and discounted repairs — pick
            the plan that matches your usage.
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.slug}
              className="relative flex flex-col gap-4 rounded-2xl border border-border bg-card p-6"
            >
              {plan.badge ? (
                <span className="absolute -top-3 right-4 inline-flex rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                  {plan.badge}
                </span>
              ) : null}
              <div>
                <h2 className="text-xl font-bold">{plan.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
              </div>
              <div>
                <p className="text-3xl font-bold">{plan.price}</p>
                <p className="text-xs text-muted-foreground">{plan.cadence}</p>
              </div>
              <ul className="space-y-2 text-sm">
                {plan.perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                    <span>{perk}</span>
                  </li>
                ))}
              </ul>
              <Button asChild className="mt-auto">
                <Link href={`/book?plan=${plan.slug}`}>Choose {plan.name}</Link>
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Perk
            icon={<ShieldCheck className="size-5" aria-hidden />}
            title="Parts coverage"
            description="Up to 25% off genuine OEM spare parts."
          />
          <Perk
            icon={<Zap className="size-5" aria-hidden />}
            title="Priority dispatch"
            description="Skip the queue — your jobs go to the top of the dispatcher's board."
          />
          <Perk
            icon={<Sparkles className="size-5" aria-hidden />}
            title="Concierge support"
            description="Dedicated WhatsApp line for Premium customers."
          />
        </div>
      </section>

      <Faq items={SITE_FAQS} />
      <CtaBand title="Get an AMC plan in 2 minutes" />
    </>
  );
}

function Perk({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-border bg-muted/20 p-5">
      <div className="flex size-10 items-center justify-center rounded-lg bg-background text-primary ring-1 ring-border">
        {icon}
      </div>
      <h3 className="mt-3 text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
