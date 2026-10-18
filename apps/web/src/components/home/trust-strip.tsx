import { Award, Shield, Star, Users, Zap } from 'lucide-react';

import { aggregateRatingLd, type PublicStats } from '@/lib/public-api';
import { formatNumber } from '@/lib/utils';

/**
 * Numeric trust strip — surfaces "social proof at scale" stats.
 * Server-rendered for SEO (numbers should appear in raw HTML, not
 * after hydration).
 */
export function TrustStrip({ stats }: { stats: PublicStats }) {
  // Only real figures from the API are shown; a stat with no data is left out.
  const rating = aggregateRatingLd(stats);
  const items = [
    stats.completedRepairs
      ? { icon: Users, value: formatNumber(stats.completedRepairs), label: 'Repairs completed' }
      : null,
    { icon: Shield, value: '30-day', label: 'Service warranty' },
    rating
      ? { icon: Star, value: `${rating.rating.toFixed(1)} / 5`, label: `Across ${formatNumber(rating.count)} reviews` }
      : null,
    { icon: Zap, value: '60 min', label: 'Avg. response' },
    stats.citiesLive ? { icon: Award, value: formatNumber(stats.citiesLive), label: 'Cities live' } : null,
  ].filter((i): i is NonNullable<typeof i> => i !== null);
  return (
    <section className="border-y border-border bg-muted/30">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-8 px-4 py-10 sm:grid-cols-3 sm:px-6 lg:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]">
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
