'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

import { JsonLd } from '@/components/seo/json-ld';
import type { Faq as FaqItem } from '@/content/faqs';
import { faqJsonLd } from '@/lib/seo/json-ld';
import { cn } from '@/lib/utils';

/**
 * Accessible accordion. Each item is a real `<button>` inside an
 * `<h3>` so keyboard navigation + screen readers behave correctly,
 * and the surrounding section auto-emits FAQ JSON-LD for rich results.
 */
export function Faq({
  items,
  title = 'Frequently asked questions',
  includeJsonLd = true,
}: {
  items: FaqItem[];
  title?: string;
  includeJsonLd?: boolean;
}) {
  const [open, setOpen] = useState<number | null>(0);

  if (items.length === 0) return null;

  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">FAQ</p>
        <h2 className="mt-1 text-balance text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      </div>

      <div className="mt-10 divide-y divide-border rounded-2xl border border-border bg-card">
        {items.map((item, idx) => {
          const isOpen = open === idx;
          return (
            <div key={item.question} className="px-5">
              <h3>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 py-5 text-left"
                  aria-expanded={isOpen}
                  aria-controls={`faq-${idx}`}
                  onClick={() => setOpen(isOpen ? null : idx)}
                >
                  <span className="text-base font-medium text-foreground">{item.question}</span>
                  <ChevronDown
                    className={cn(
                      'size-4 shrink-0 text-muted-foreground transition-transform',
                      isOpen ? 'rotate-180' : '',
                    )}
                    aria-hidden
                  />
                </button>
              </h3>
              <div
                id={`faq-${idx}`}
                className={cn(
                  'grid overflow-hidden transition-[grid-template-rows] duration-300',
                  isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                )}
              >
                <div className="overflow-hidden">
                  <p className="pb-5 pr-8 text-sm text-muted-foreground">{item.answer}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {includeJsonLd ? <JsonLd data={faqJsonLd(items)} /> : null}
    </section>
  );
}
