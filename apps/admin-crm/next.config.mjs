/** @type {import('next').NextConfig} */
const apiOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').origin;
  } catch {
    return 'http://localhost:4000';
  }
})();
const wsOrigin = apiOrigin.replace(/^http/, 'ws');
const isDev = process.env.NODE_ENV !== 'production';

/**
 * Staff-only app: no third-party scripts, never framed. Next needs inline
 * scripts for hydration ('unsafe-inline'; 'unsafe-eval' only in dev for HMR).
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  `connect-src 'self' ${apiOrigin} ${wsOrigin}${isDev ? ' ws://localhost:* http://localhost:*' : ''}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
  ...(isDev ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]),
];

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  poweredByHeader: false,
  experimental: {
    typedRoutes: true,
    optimizePackageImports: ['lucide-react', '@ac/ui'],
  },
  transpilePackages: ['@ac/ui', '@ac/types', '@ac/config', '@ac/analytics'],
};

export default nextConfig;
