import { baseConfig } from '@ac/eslint-config/base';

export default [
  ...baseConfig,
  {
    ignores: ['prisma/migrations/**', 'src/generated/**'],
  },
];
