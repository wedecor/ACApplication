import { Star } from 'lucide-react';

import { Badge } from '@ac/ui';

import { FEATURED_TECHNICIANS } from '@/content/technicians';
import { formatNumber } from '@/lib/utils';

/**
 * Surfaces the actual people behind the platform. The customer chooses
 * a service brand based on trust — letting them put a face to the work
 * is one of the highest-converting trust signals we can ship.
 */
export function TechnicianShowcase() {
  return (
    <section className="border-y border-border bg-muted/20">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            The people behind the work
          </p>
          <h2 className="mt-1 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Background-verified. Brand-certified. Rating-tracked.
          </h2>
          <p className="mt-3 text-base text-muted-foreground">
            Every technician on the platform goes through a 7-step vetting process — ID
            verification, brand certification, in-person interview, and on-job mentoring.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURED_TECHNICIANS.map((tech) => (
            <div
              key={tech.id}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 text-center"
            >
              <div
                className="mx-auto flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-accent/20 text-lg font-semibold"
                aria-hidden
              >
                {tech.name
                  .split(' ')
                  .map((p) => p[0])
                  .join('')
                  .slice(0, 2)}
              </div>
              <div>
                <h3 className="text-base font-semibold">{tech.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {tech.experienceYears} yrs · {tech.citySlug.charAt(0).toUpperCase() + tech.citySlug.slice(1)}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-1">
                {tech.specialisations.map((spec) => (
                  <Badge key={spec} variant="muted" className="text-[10px]">
                    {spec}
                  </Badge>
                ))}
              </div>
              <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
                <span className="font-medium text-foreground">{tech.rating.toFixed(1)}</span>
                <span>·</span>
                <span>{formatNumber(tech.jobsCompleted)} jobs</span>
              </div>
              <blockquote className="text-xs italic text-muted-foreground">“{tech.quote}”</blockquote>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
