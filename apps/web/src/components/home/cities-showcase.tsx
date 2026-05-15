import Link from 'next/link';
import { ArrowRight, MapPin } from 'lucide-react';

import { CITIES } from '@/content/cities';
import { formatNumber } from '@/lib/utils';

export function CitiesShowcase() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Service area</p>
          <h2 className="mt-1 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Live in 3 cities. Expanding to 15+ by 2026.
          </h2>
        </div>
        <Link
          href="/cities"
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          View all cities <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CITIES.filter((c) => c.isLive).map((city) => (
          <Link
            key={city.slug}
            href={`/${city.slug}` as never}
            className="group flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
          >
            <header className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <MapPin className="size-4 text-primary" aria-hidden /> {city.name}
              </h3>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                Live
              </span>
            </header>
            <dl className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Bookings" value={formatNumber(city.completedBookings)} />
              <Stat label="Response" value={`${city.avgResponseMin}m`} />
              <Stat label="Rating" value={`${city.rating}★`} />
            </dl>
            <p className="text-xs text-muted-foreground line-clamp-2">
              Serving {city.areas
                .slice(0, 4)
                .map((a) => a.name)
                .join(', ')}{' '}
              + {city.areas.length - 4} more areas.
            </p>
            <span className="inline-flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
              Book in {city.name} <ArrowRight className="size-3.5" aria-hidden />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm font-semibold">{value}</dd>
    </div>
  );
}
