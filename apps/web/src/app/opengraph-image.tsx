import { ImageResponse } from 'next/og';

import { siteConfig } from '@/env';

export const runtime = 'edge';
export const size = { width: 1200, height: 630 } as const;
export const contentType = 'image/png';
export const alt = `${siteConfig.name} — Home Appliance Repair`;

/**
 * Default Open Graph image. Per-page OG images can override this by
 * adding their own `opengraph-image.tsx` colocated with the page; Next
 * resolves the nearest one automatically.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 80,
          background:
            'linear-gradient(135deg, #0a1e3f 0%, #1e3a8a 60%, #0a1e3f 100%)',
          color: '#fff',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: 14,
              background: '#fff',
              color: '#0a1e3f',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            {siteConfig.shortName.slice(0, 2)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 28, fontWeight: 600 }}>{siteConfig.name}</span>
            <span style={{ fontSize: 18, opacity: 0.7 }}>acplatform.example.com</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <h1
            style={{
              fontSize: 76,
              fontWeight: 800,
              lineHeight: 1.05,
              margin: 0,
              letterSpacing: '-0.03em',
            }}
          >
            Same-day appliance repair from verified pros.
          </h1>
          <p style={{ fontSize: 28, opacity: 0.85, margin: 0 }}>
            AC · Fridge · Washing Machine · Microwave · Chimney
          </p>
        </div>

        <div style={{ display: 'flex', gap: 32, fontSize: 22 }}>
          <span>30-day warranty</span>
          <span>·</span>
          <span>60-minute response</span>
          <span>·</span>
          <span>4.8 / 5 — 26,400 reviews</span>
        </div>
      </div>
    ),
    size,
  );
}
