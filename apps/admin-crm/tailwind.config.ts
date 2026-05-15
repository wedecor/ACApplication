import preset from '@ac/ui/tailwind-preset';
import type { Config } from 'tailwindcss';

const config: Config = {
  presets: [preset],
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
};

export default config;
