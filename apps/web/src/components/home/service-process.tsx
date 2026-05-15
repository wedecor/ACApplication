'use client';

import { motion } from 'framer-motion';
import { CalendarCheck, MessageSquare, Truck, Wrench } from 'lucide-react';

/**
 * "How it works" section — four-step funnel rendered as a left-to-right
 * timeline on desktop, stacked on mobile. Each step has a concrete
 * promise ("WhatsApp quote in 30 minutes") rather than a vague benefit.
 */
export function ServiceProcess() {
  const steps = [
    {
      icon: MessageSquare,
      title: 'Tell us the issue',
      description: 'Pick the appliance, describe the problem, choose a 2-hour slot. 60 seconds.',
    },
    {
      icon: CalendarCheck,
      title: 'Slot confirmed',
      description: 'Verified technician is assigned. You get a WhatsApp confirmation in 5 minutes.',
    },
    {
      icon: Truck,
      title: 'Live tracking',
      description: 'See the technician en route on the map. Call them directly if needed.',
    },
    {
      icon: Wrench,
      title: 'Repair & 30-day warranty',
      description: 'You approve the quote on WhatsApp. Pay only after the job. 30-day warranty.',
    },
  ];

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">How it works</p>
        <h2 className="mt-1 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          From booking to repaired — typically the same day.
        </h2>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, idx) => (
          <motion.div
            key={step.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: idx * 0.06 }}
            className="relative rounded-2xl border border-border bg-card p-6"
          >
            <span className="absolute -top-3 left-6 inline-flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-md">
              {idx + 1}
            </span>
            <div className="mt-2 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <step.icon className="size-5" aria-hidden />
            </div>
            <h3 className="mt-4 text-base font-semibold">{step.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
