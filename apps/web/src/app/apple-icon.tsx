import { renderAppIcon } from '@/lib/brand/app-icon';

export const runtime = 'edge';
export const size = { width: 180, height: 180 } as const;
export const contentType = 'image/png';

export default function AppleIcon() {
  return renderAppIcon(180, { maskable: true });
}
