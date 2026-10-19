import { baseConfig, untypedConfig } from '@ac/eslint-config/base';

// Specs are excluded from the build tsconfig, so they are linted untyped.
export default [...baseConfig, untypedConfig(['**/*.spec.ts', '**/*.test.ts', '**/__tests__/**'])];
