// @ts-check
import { reactConfig } from './react.js';

/**
 * React Native (Expo) ESLint preset.
 *
 * @type {import('eslint').Linter.Config[]}
 */
export const reactNativeConfig = [
  ...reactConfig,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // RN doesn't honor <a> / anchor-is-valid in the same way; relax a11y rules
      // that are web-only and lean into RN accessibility props instead.
      'jsx-a11y/anchor-is-valid': 'off',
      'jsx-a11y/click-events-have-key-events': 'off',
      'jsx-a11y/no-static-element-interactions': 'off',
    },
  },
];

export default reactNativeConfig;
