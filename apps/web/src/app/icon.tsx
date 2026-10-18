import { renderAppIcon } from '@/lib/brand/app-icon';

export const runtime = 'edge';
export const size = { width: 32, height: 32 } as const;
export const contentType = 'image/png';

export default function Icon() {
  return renderAppIcon(32);
}
