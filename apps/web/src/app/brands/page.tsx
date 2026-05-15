import type { Metadata } from 'next';
import Link from 'next/link';

import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { BRANDS } from '@/content/brands';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Appliance Brands We Service — LG, Samsung, Daikin, Whirlpool & More',
  description:
    'Authorised-grade home appliance repair for LG, Samsung, Daikin, Voltas, Whirlpool, IFB, Bosch and 20+ other brands. Genuine parts, 30-day warranty.',
  path: '/brands',
  keywords: BRANDS.map((b) => `${b.name.toLowerCase()} service`),
});

export default function BrandsIndex() {
  return (
    <>
      <Breadcrumbs items={[{ name: 'Home', href: '/' }, { name: 'Brands', href: '/brands' }]} />
      <header className="border-b border-border bg-muted/20">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
          <h1 className="max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            Every major brand. Authorised-grade service.
          </h1>
          <p className="mt-3 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
            Our technicians are certified for every major appliance brand sold in India — and we
            only fit genuine, OEM-spec spare parts.
          </p>
        </div>
      </header>
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BRANDS.map((brand) => (
            <Link
              key={brand.slug}
              href={`/brands/${brand.slug}` as never}
              className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
            >
              <h2 className="text-base font-semibold">{brand.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{brand.tagline}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                {brand.services.length} services · {brand.repairsCompleted.toLocaleString('en-IN')} jobs
              </p>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
