import typography from '@tailwindcss/typography';
import preset from '@ac/ui/tailwind-preset';
import type { Config } from 'tailwindcss';

const config: Config = {
  presets: [preset],
  content: [
    './src/**/*.{ts,tsx,md,mdx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  plugins: [typography],
};

export default config;
