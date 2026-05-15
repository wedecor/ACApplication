/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    typedRoutes: true,
    optimizePackageImports: ['lucide-react', '@ac/ui'],
  },
  transpilePackages: ['@ac/ui', '@ac/types', '@ac/config', '@ac/analytics'],
};

export default nextConfig;
