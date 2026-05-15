'use client';

import { useEffect, useRef, useState } from 'react';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
  formatter?: (n: number) => string;
}

function formatInteger(n: number): string {
  return n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function AnimatedCounter({
  value,
  duration = 2.2,
  className,
  formatter = formatInteger,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(() => formatter(0));
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || started) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { rootMargin: '-40px', threshold: 0.1 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;

    let frame = 0;
    const startAt = performance.now();
    const durationMs = duration * 1000;

    const tick = (now: number) => {
      const progress = Math.min((now - startAt) / durationMs, 1);
      const eased = easeOutCubic(progress);
      setDisplay(formatter(Math.round(value * eased)));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [started, value, duration, formatter]);

  return (
    <span ref={ref} className={className}>
      {display}
    </span>
  );
}
