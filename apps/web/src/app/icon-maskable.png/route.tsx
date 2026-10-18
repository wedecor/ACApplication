import { renderAppIcon } from '@/lib/brand/app-icon';

export const runtime = 'edge';

/** Full-bleed maskable PWA icon (purpose: maskable in app/manifest.ts). */
export function GET() {
  return renderAppIcon(512, { maskable: true });
}
