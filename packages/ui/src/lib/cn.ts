import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Standard `cn` utility — merges Tailwind classes while preserving the
 * `clsx`/`classnames`-style conditional API.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
