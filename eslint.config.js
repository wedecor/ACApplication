// Root ESLint flat config — delegates to package-level configs.
// Each app/package owns its own `eslint.config.js` extending @ac/eslint-config.
import { baseConfig } from '@ac/eslint-config/base';

export default [
  ...baseConfig,
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/.expo/**',
      '**/coverage/**',
      '**/generated/**',
      'packages/database/prisma/migrations/**',
    ],
  },
];
