# Agent guidelines

Conventions automated agents (and humans) must follow when contributing to this repo.

## Package discipline

- New shared logic goes into `packages/*`, not `apps/*`.
- Apps consume packages; packages do not import apps.
- Never reach into `node_modules/.pnpm` paths.

## TypeScript

- `strict: true` everywhere. Do not weaken `tsconfig` to silence errors.
- Prefer `unknown` over `any`. If `any` is unavoidable, leave a comment explaining why.
- Re-export types via `export type { ... }` to keep declaration emit clean.

## Imports

- Run `pnpm lint:fix` before committing — `simple-import-sort` enforces order.
- Use the `@/*` path alias inside an app; use `@ac/<package>` across workspaces.

## Database

- Schema changes require a Prisma migration. Never `prisma db push` against shared environments.
- All new domain tables MUST include `createdAt`, `updatedAt`, `deletedAt`, and (for audited tables) `createdBy` / `updatedBy` / `deletedBy`.
- Money columns end in `Minor` and are `Int` (integer minor units).

## API

- Every controller method has:
  - explicit `@ApiOperation` and `@ApiTags` for OpenAPI;
  - a Zod or class-validator DTO;
  - either `@Public()` or default-protected (global guard).
- Errors must be `HttpException` subclasses or domain-specific exceptions; never throw raw `Error`.

## Logging

- Never log secrets, tokens, raw OTP codes, full card numbers, or PII not strictly required for the operation.
- Pino redaction is configured in `apps/api/src/common/logger/logger.module.ts` — add new paths there if you introduce new sensitive fields.

## Tests

- Add a unit test alongside any new pure function or service method.
- Cross-cutting changes require an e2e Playwright test.

## Commits & PRs

- Conventional commits: `feat(scope): …`.
- One logical change per PR; refactors separate from features.
- Link issues. Fill out the PR template.
