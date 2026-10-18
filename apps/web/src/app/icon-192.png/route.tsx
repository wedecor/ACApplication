import { renderAppIcon } from '@/lib/brand/app-icon';

export const runtime = 'edge';

/** PWA manifest icon (referenced from app/manifest.ts). */
export function GET() {
  return renderAppIcon(192);
}
