# @ac/ui

Shared React design system: Tailwind preset, design tokens, Shadcn-style primitives, and motion utilities.

## Consume in a Next.js app

1. **Tailwind preset** — extend in your app's `tailwind.config.ts`:

   ```ts
   import preset from '@ac/ui/tailwind-preset';
   export default {
     presets: [preset],
     content: ['./app/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
   };
   ```

2. **Global CSS** — import once at the root of your `app/layout.tsx`:

   ```ts
   import '@ac/ui/styles';
   ```

3. **Components** — tree-shakeable named exports:

   ```tsx
   import { Button, Card, EmptyState } from '@ac/ui';
   ```

## Add a new component

Components live in `src/components/*.tsx`. Re-export them from `src/index.ts`. Prefer composing Radix primitives + `cva` for variants and `cn` for class merging.
