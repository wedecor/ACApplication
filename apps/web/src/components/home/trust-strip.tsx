import { Award, Shield, Star, Users, Zap } from 'lucide-react';

import { formatNumber } from '@/lib/utils';

/**
 * Numeric trust strip — surfaces "social proof at scale" stats.
 * Server-rendered for SEO (numbers should appear in raw HTML, not
 * after hydration).
 */
export function TrustStrip(props: {
  bookings?: number;
  cities?: number;
  rating?: number;
  reviews?: number;
}) {
  const items = [
    {
      icon: Users,
      value: formatNumber(props.bookings ?? 130_000),
      label: 'Repairs completed',
    },
    {
      icon: Shield,
      value: '30-day',
      label: 'Service warranty',
    },
    {
      icon: Star,
      value: `${props.rating ?? 4.8} / 5`,
      label: `Across ${formatNumber(props.reviews ?? 26_400)} reviews`,
    },
    {
      icon: Zap,
      value: '60 min',
      label: 'Avg. response',
    },
    {
      icon: Award,
      value: formatNumber(props.cities ?? 3),
      label: 'Cities live',
    },
  ];
  return (
    <section className="border-y border-border bg-muted/30">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-8 px-4 py-10 sm:grid-cols-3 sm:px-6 lg:grid-cols-5">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-background text-primary shadow-sm ring-1 ring-border">
              <item.icon className="size-5" aria-hidden />
            </div>
            <div>
              <p className="text-base font-bold leading-tight">{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
