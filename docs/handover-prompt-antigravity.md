# Handover prompt: continue `feat/crm-audit-gaps`

You are continuing work on the AC Project monorepo at `/home/nmc-40324/Desktop/AC Project` (pnpm + Turborepo; NestJS API, Next.js web + admin CRM, Expo customer and technician apps, shared `packages/*`, Prisma).

## Read first

1. `AGENTS.md`: repo rules. They are binding; follow them exactly.
2. `docs/handover-crm-audit-gaps.md`: full state of this branch. It covers what was done, verification status, known issues, gaps and next steps.
3. `docs/architecture.md` and the docs for whichever area you touch.

## Current state (2026-10-19)

- Branch `feat/crm-audit-gaps`: 62 commits ahead of `main`. It is **not pushed**, and there is no PR.
- The last code commit is `c222fcb refactor(packages): lint clean`; the commit after it adds the handover docs.
- `pnpm turbo run lint typecheck test` is green: 39/39 lint+typecheck tasks and 14/14 test tasks.
- The handover docs (`docs/handover-crm-audit-gaps.md` and this file) are committed on the branch.
- Not yet run: `pnpm test:e2e`, `pnpm db:migrate:deploy` against a real DB, `pnpm audit:rbac`, `qa:lifecycle`, `qa:chaos`.
- Local Node is v20.20.2, but the repo requires Node 22.11 or newer (CI uses 22). Use Node 22 (`nvm use 22`).

## Your tasks, in priority order

Make one logical change per commit, using Conventional Commits (`feat(scope): …`, `fix(scope): …`, `test(scope): …`, `docs: …`). Keep refactors separate from features.

1. **Add OpenAPI docs to routes.** 89 of 441 routes lack `@ApiOperation`. Start with these controllers:
   - `apps/api/src/modules/bookings/bookings.controller.ts` (10)
   - `payouts/payouts.controller.ts` (9)
   - `amc/amc.controller.ts` (9)
   - `support/knowledge-base.controller.ts` (8)
   - `support/conversations.controller.ts` (7)
   - `support/call-center.controller.ts` (7)
   - then the rest

   Each route also needs `@ApiTags` and a DTO. To find gaps, compare the count of `@(Get|Post|Put|Patch|Delete)(` with the count of `@ApiOperation` per `*.controller.ts`. One commit per module is fine.

2. **Add unit tests** for the modules that have none: `finance-events`, `finance-scheduler`, `finance-analytics` first, then `technician-availability`, `activity`, `health`. Place them alongside the existing `*.spec.ts` patterns in the module tree.
3. **Add Playwright e2e tests for the security fixes.** These are cross-cutting, and AGENTS.md requires e2e coverage for them. Cover:
   - login and logout
   - the httpOnly refresh cookie and refresh-token reuse detection
   - OTP rate limiting
   - tenant isolation (a customer or technician cannot read another's records)

   The only existing spec is `apps/web/e2e/smoke.spec.ts`; follow its setup. `PLAYWRIGHT_BASE_URL` is already declared in `turbo.json`.

4. **Block the console email and push transports in production.** `packages/config/src/env/schema.ts` rejects `SMS_PROVIDER=console` in production. Do the same for `EMAIL_PROVIDER` and `PUSH_PROVIDER`, and make sure `apps/api/src/modules/notifications/notification-failover.dispatcher.ts` never falls back to `ConsoleTransport` in production. Add tests.
5. **Fix stale docs.** `docs/public-website.md` §5 says backend `x-internal-token` verification is a TODO. It is already implemented in `apps/api/src/common/security/internal-proxy.ts`. Update the doc.

Stop after task 5 and report back. Do not start on these items without asking first:

- missing features (AI support hooks, inbound email, technician availability and earnings screens)
- moving `@OnEvent` listeners to BullMQ or an outbox
- a repo-wide Prettier run

## Verification before every commit

```bash
pnpm turbo run lint typecheck test --continue
pnpm lint:fix   # simple-import-sort order
```

All must pass. If something fails, fix it or report it with the exact output. Never weaken `tsconfig`, disable lint rules, or skip tests to make checks pass. If a tooling file trips type-aware lint, use `untypedConfig([...])` from `packages/eslint-config/base.js`.

## Hard rules (from AGENTS.md and this project)

- Shared logic goes in `packages/*`. Packages never import from apps.
- Use `strict` TS. Prefer `unknown` to `any`; if `any` is unavoidable, explain why in a comment.
- Throw only `HttpException` subclasses or domain exceptions, never a raw `Error`.
- Never log secrets, tokens, OTP codes, card numbers or unneeded PII. Add new sensitive fields to the redaction list in `apps/api/src/common/logger/logger.module.ts`.
- Schema changes need a Prisma migration. Never run `prisma db push`. New tables get `createdAt`, `updatedAt` and `deletedAt` (plus `createdBy`, `updatedBy` and `deletedBy` if audited). Money columns are `Int` named `…Minor`.
- Do **not** push, open PRs, force-push, rebase shared history, or touch `main` without asking.
- Do **not** reformat unrelated files. Prettier debt predates this branch, and a cleanup belongs in its own `style:` PR.
- End commit messages with your own co-author trailer, if your tool adds one.

## When you finish

Report:

- the commits made, with hash and subject
- check results
- anything skipped or failing, with output
- suggested next steps

Update the "Next steps" and "Gaps and improvements" sections of `docs/handover-crm-audit-gaps.md` to reflect what you completed.
