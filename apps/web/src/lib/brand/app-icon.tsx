import { ImageResponse } from 'next/og';

/** Brand mark (white "AC" on the primary blue) rendered as a square PNG of any size. */
export function renderAppIcon(size: number, { maskable = false }: { maskable?: boolean } = {}) {
  // Maskable icons need a safe zone; regular icons use rounded corners like the header mark.
  const radius = maskable ? 0 : Math.round(size * 0.22);
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1d6ff2',
          borderRadius: radius,
          color: '#ffffff',
          fontSize: Math.round(size * (maskable ? 0.36 : 0.46)),
          fontWeight: 800,
          letterSpacing: '-0.04em',
        }}
      >
        AC
      </div>
    ),
    { width: size, height: size },
  );
}
