# Development workflow

A pragmatic, opinionated guide for working in this monorepo.

## Branching model

- `main` — protected. Always deployable. Squash-merge from PR.
- `develop` — integration branch (optional; teams may go trunk-based).
- `feat/<scope>-<slug>` — new functionality
- `fix/<scope>-<slug>` — bug fixes
- `chore/<slug>` — tooling, deps
- `refactor/<scope>-<slug>` — no behavior change
- `docs/<slug>` — documentation only

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org):

```
<type>(<scope>): <subject>

<body — why, not what>
```

Examples:

```
feat(api): introduce auth/otp issue + verify endpoints
fix(ui): correct focus ring contrast in dark mode
refactor(database): extract audit extension into its own file
```

`scope` is the workspace name without the `@ac/` prefix (`api`, `web`, `ui`, …).

## Local loop

```bash
pnpm install
pnpm db:generate
pnpm dev
```

Hot reload covers every app. The Prisma client must be regenerated whenever the schema changes:

```bash
pnpm db:migrate    # creates + applies migration
pnpm db:generate   # regenerates client
```

## Code style

- **Strict TypeScript everywhere.** `any` is a warning; PRs introducing one need a comment justifying it.
- **No barrel files in apps.** Use explicit imports from the file that defines the symbol. Packages may have a single `src/index.ts` barrel.
- **Prefer composition over inheritance.** Services should be small and injectable.
- **Boundaries.** Controllers parse + validate; services orchestrate; repositories own Prisma; everything else is pure.
- **Comments.** Explain *why*, not *what*. The code already says what.

## Pre-commit

Husky + lint-staged run on every commit:

```
*.{ts,tsx,js,jsx}    → prettier --write, eslint --fix
*.{json,md,yml,yaml} → prettier --write
```

To bypass in an emergency: `git commit --no-verify` (only with a follow-up commit fixing the issue).

## Pull request expectations

- Small. ≤ 400 lines diff is ideal; > 1000 needs justification.
- Linked to a tracking issue.
- CI green: lint, typecheck, unit tests, build.
- Includes tests for the new behavior.
- Updates `.env.example` and `@ac/config` schema for any new env var.
- Updates `packages/database/prisma/schema.prisma` migrations folder for any DB change.
- Updates Swagger annotations for any new HTTP endpoint.

## Adding a new package

```bash
# 1) Scaffold
mkdir -p packages/my-package/src
cd packages/my-package
# package.json — copy fields from another package (name, exports, scripts)
# tsconfig.json — extends @ac/typescript-config/node-library.json
# eslint.config.js — re-exports baseConfig
# src/index.ts — your exports

# 2) Register in the consumer's package.json
"@ac/my-package": "workspace:*"

# 3) Install
pnpm install
```

## Adding a new app

1. Decide tech (Next.js / NestJS / Expo) and pick the right `@ac/typescript-config` preset.
2. Create `apps/<name>/package.json`, `tsconfig.json`, `eslint.config.js`, framework configs.
3. Re-use shared providers (`@ac/ui`, `@ac/config`, `@ac/types`, `@ac/auth`).
4. Add `.env.example` and Zod schema entries.
5. Add a `dev`, `build`, `lint`, `test`, `typecheck` script — `turbo` picks them up automatically.

## Releases

- All apps and packages share the same version vector via Changesets (`pnpm changeset`).
- Production releases are tagged from `main`; the deploy pipeline runs `pnpm build` and uploads artifacts.

## Debugging tips

- Pino emits structured JSON in prod; in dev it's pretty-printed.
- `x-request-id` is round-tripped to the client; use it to grep logs.
- `pnpm db:studio` is the fastest way to inspect a row.
- Use `pnpm --filter <pkg> ...` instead of `cd`ing into a package.
- `turbo run dev --filter=@ac/api^...` runs `api` plus everything it depends on.
