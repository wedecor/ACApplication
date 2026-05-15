import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import { JsonLd } from '@/components/seo/json-ld';
import { breadcrumbsJsonLd } from '@/lib/seo/json-ld';

export interface BreadcrumbItem {
  name: string;
  href: string;
}

/**
 * Renders both the visible breadcrumb trail and the BreadcrumbList
 * JSON-LD. Keep them in lock-step — divergence causes Google to flag a
 * "missing breadcrumb" warning in Search Console.
 */
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (items.length === 0) return null;
  return (
    <>
      <nav
        aria-label="Breadcrumb"
        className="mx-auto flex max-w-7xl items-center gap-1.5 px-4 py-3 text-xs text-muted-foreground sm:px-6"
      >
        <ol className="flex flex-wrap items-center gap-1.5">
          {items.map((item, idx) => {
            const isLast = idx === items.length - 1;
            return (
              <li key={item.href} className="flex items-center gap-1.5">
                {isLast ? (
                  <span aria-current="page" className="text-foreground">
                    {item.name}
                  </span>
                ) : (
                  <Link href={item.href as never} className="hover:text-foreground">
                    {item.name}
                  </Link>
                )}
                {!isLast ? (
                  <ChevronRight className="size-3 text-muted-foreground/60" aria-hidden />
                ) : null}
              </li>
            );
          })}
        </ol>
      </nav>
      <JsonLd
        data={breadcrumbsJsonLd(items.map((i) => ({ name: i.name, url: i.href })))}
      />
    </>
  );
}
