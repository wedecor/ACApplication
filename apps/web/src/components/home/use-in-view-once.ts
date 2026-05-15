'use client';

import { type RefObject, useEffect, useRef, useState } from 'react';

/**
 * Fires once when the element enters the viewport.
 */
export function useInViewOnce(options?: IntersectionObserverInit): [RefObject<HTMLElement | null>, boolean] {
  const ref = useRef<HTMLElement | null>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setSeen(true);
          obs.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.12, ...options },
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [seen, options?.rootMargin, options?.threshold]);

  return [ref, seen];
}
