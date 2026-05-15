// @ts-check
import { baseConfig } from './base.js';

/**
 * NestJS ESLint preset. Relaxes a few rules common in decorator-heavy code.
 *
 * @type {import('eslint').Linter.Config[]}
 */
export const nestConfig = [
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: {
      // NestJS heavily uses class decorators and DI containers.
      '@typescript-eslint/no-extraneous-class': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      // Controllers/providers often have unused `_request` params.
      '@typescript-eslint/no-unused-vars': 'off',
      // Allow `any` for low-level Fastify/Express request typing.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
];

export default nestConfig;
