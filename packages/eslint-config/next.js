// @ts-check
import nextPlugin from '@next/eslint-plugin-next';

import { reactConfig } from './react.js';

/**
 * Next.js ESLint preset. Combines React + Next core-web-vitals rules.
 *
 * @type {import('eslint').Linter.Config[]}
 */
export const nextConfig = [
  ...reactConfig,
  {
    plugins: {
      '@next/next': nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
];

export default nextConfig;
