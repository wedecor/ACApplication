# Handover: feat/crm-audit-gaps

Oct 19, 2026 · @Valleesh

## Summary

`feat/crm-audit-gaps` is complete locally and green, but it is not pushed and has no PR yet. It holds 61 commits on top of `main`, made Oct 16–19, 2026, covering 857 files (+62,015 / −5,702 lines). The working tree is clean.

The branch has three layers:

- **New features:** repair, CRM, growth and sales domains, the technician and customer apps, and quotation approval.
- **Audit fixes:** security, finance, reliability, realtime, mobile and web.
- **Lint cleanup:** a lint-clean pass across every app and shared package.

It adds 4 Prisma migrations and 13 environment variables. Both must be applied in each environment before deploying.

## What was done

The work is grouped by area below. The commit list under Reference has the detail.

| Area                     | Main changes                                                                                                                                                                                                                                                                              | Key commits                                                                 |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Domain and features      | Repair (appliances, service catalog, job cards, warranty, workshop); CRM marketing, B2B sales, tasks, custom fields, import/export; technician onboarding and staff role management; quotation approval page for customers                                                                | `cbb151d`, `9533a07`, `36eec94`, `06da055`, `0dbfa10`                       |
| Mobile apps              | Technician app: phone OTP sign-in, job cards, photos, signature, quotes, field payments. Customer app: self-service endpoints, Expo web. Both: wipe account data on sign-out, real biometric unlock                                                                                       | `c44e03b`, `949b9cf`, `b625404`, `000610a`                                  |
| Security                 | Customers and technicians scoped to their own records; OTP and request rate limits; locked-down public web chat; webhooks fail closed; httpOnly refresh cookie and real logout; refresh-token reuse detection; signed upload sizes; cross-tenant foreign keys; HMAC-signed location pings | `101471c`, `6cbba8d`, `a029b84`, `8e0ab3c`, `cafb6d9`, `e091848`, `557abaf` |
| Finance                  | Safe gateway refunds; race-free payouts; atomic per-tenant document numbers; quote GST; stale payment reconciliation                                                                                                                                                                      | `529003c`, `d9af42a`, `c1768a6`                                             |
| Reliability and realtime | Each scheduled job runs on one instance; error tracking; provider timeouts; Redis readiness; tenant-isolated websocket rooms; SLA notices no longer re-sent every minute                                                                                                                  | `f0cd36f`, `9585015`, `d0533fd`, `08ab4af`                                  |
| Web and admin CRM        | CSP, HSTS and bounded lead attribution; only real ratings and stats shown; layouts fixed at phone size across admin screens                                                                                                                                                               | `c403b56`, `246753d`, `61cf746`                                             |
| Build and CI             | API Docker image, EAS profiles, Node 22, e2e tests in CI                                                                                                                                                                                                                                  | `1374aa0`                                                                   |

**Migrations added**, in `packages/database/prisma/migrations/`:

1. `20261016163214_crm_repair_growth_domain`
2. `20261018090000_backfill_customer_stats`
3. `20261018100000_per_tenant_document_numbers`
4. `20261018120000_refresh_token_reuse_detection`

**New environment variables**, documented in `.env.example`: `OTP_ISSUE_LIMIT`, `OTP_LOCK_WINDOW_SECONDS`, `TRUST_PROXY`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL`, `S3_FORCE_PATH_STYLE`, `UPLOAD_MAX_BYTES`, `UPLOAD_URL_TTL_SECONDS`, `CORS_EXTRA_ORIGINS`.

## Lint-clean pass

`pnpm lint` now passes across the workspace. There is one `refactor(<scope>): lint clean` commit per app and one for the shared packages.

- **Apps:** `api` (`50691a7`, which also typechecks tests), `admin-crm` (`1bfb4ba`), `web` (`afffff9`, which also fixes lead route tests not loading), `customer-app` (`e4b15fe`), `technician-app` (`fa682f6`).
- **Packages:** `c222fcb` covers `auth`, `config`, `database`, `notifications`, `types`, `ui`, `whatsapp` and `analytics`, plus app tooling configs. It also adds `PLAYWRIGHT_BASE_URL` to `turbo.json`.
- **New helper:** `untypedConfig(files)` in `packages/eslint-config/base.js` lints files outside a package's tsconfig `include` without type information. These are config files, setup files, `e2e/` and `test-stubs/`. Use it, rather than widening tsconfig, when a new file of this kind trips the typed rules.

## Verification status

Lint, typecheck and unit tests pass on the branch tip `c222fcb`. Nothing beyond that has been run locally.

| Check                              | Command                                       | Result (Oct 19, 2026)                                          |
| ---------------------------------- | --------------------------------------------- | -------------------------------------------------------------- |
| Lint + typecheck                   | `pnpm turbo run lint typecheck`               | Pass: 39/39 tasks, 17 packages                                 |
| Unit tests                         | `pnpm turbo run test`                         | Pass: 14/14 tasks                                              |
| Formatting                         | `prettier --check`                            | Fails, but the failures predate this branch (see Known issues) |
| E2E (Playwright)                   | `pnpm test:e2e`                               | Not run locally                                                |
| Migrations against a real database | `pnpm db:migrate:deploy`                      | Not run in this session                                        |
| RBAC audit, lifecycle and chaos QA | `pnpm audit:rbac`, `qa:lifecycle`, `qa:chaos` | Not run in this session                                        |

## Known issues and caveats

None of these block a merge. Each is worth knowing before you pick the branch up.

- **Branch not pushed.** `feat/crm-audit-gaps` exists only on the local machine and has no upstream on `origin`. Push it first so nothing is lost.
- **Too big for one PR.** At 61 commits and 857 files, the branch breaks the AGENTS.md rule of one logical change per PR, with refactors kept separate from features.
- **Prettier debt.** `prettier --check` fails on about 279 files in `apps/api` alone, and on 20 files this branch touched. These files were already unformatted on `main`, so the lint commits deliberately leave formatting alone.
- **Node version.** The repo requires Node 22.11 or newer, but this machine has v20.20.2. Every check passed on 20, but CI runs 22.
- **Turbo outputs warnings.** The `test` task in `admin-crm`, `api`, `customer-app`, `technician-app` and `web` declares outputs it never writes. This is cosmetic, and fixing it means adjusting `outputs` in `turbo.json`.
- **Open dependabot PRs.** `origin` has about 10 dependabot branches (actions, eslint, nest, next, pino and others). They may conflict with this branch's lockfile.

## Gaps and improvements

The biggest gaps are rule gaps from AGENTS.md: 89 API routes have no OpenAPI docs, and there is only one Playwright e2e test. The product gaps are mostly integrations that are still stubs. Everything below was checked against the code on Oct 19, 2026.

### Repo-rule gaps (AGENTS.md)

| Gap                                           | Evidence                                                                                                               | Fix                                                                                 |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 89 of 441 API routes lack `@ApiOperation`     | Worst: `bookings` (10), `payouts` (9), `amc` (9), support `knowledge-base` (8), `conversations` (7), `call-center` (7) | Add `@ApiOperation` to each route, controller by controller                         |
| Cross-cutting security fixes have no e2e test | The only e2e spec is `apps/web/e2e/smoke.spec.ts`                                                                      | Add Playwright tests for login and logout, the refresh cookie, and tenant isolation |
| 6 API modules have no unit tests              | `activity`, `finance-analytics`, `finance-events`, `finance-scheduler`, `health`, `technician-availability`            | Add specs, finance modules first                                                    |

### Missing features

| Feature                                      | Current state                                                                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| AI support assist                            | `support/ai-hooks.service.ts` has four stub methods (categorise, sentiment, suggest reply, summarise), and each returns `null` |
| Inbound email to tickets                     | No Postmark, Mailgun or SES adapter. Email is outbound only.                                                                   |
| Call transcription                           | `CallRecording.transcript` is never filled                                                                                     |
| Technician availability and earnings screens | The API has `technician-availability` and `payouts` modules, but the technician app has no screen for either                   |
| Lead and customer de-duplication             | No identity-resolution service. Matching relies on exact E.164 phone numbers.                                                  |
| Social channels and multi-agent tickets      | Social channels are stubbed. A ticket can have only one assignee (per `docs/omnichannel-support.md`).                          |
| Mobile e2e tests                             | Maestro and Detox flows are listed as out of scope in `docs/customer-app.md`                                                   |

### Improvements

- **Durable domain events.** Ten listeners use in-process `@OnEvent`, including finance, growth, notifications and orchestration. An event is lost if the process crashes before it is handled. Move them onto the existing BullMQ queues or add an outbox table.
- **Block console email and push in production.** The env schema rejects `SMS_PROVIDER=console` in production. Email and push still fall back to the console transport, which logs message bodies.
- **Stale docs.** `docs/public-website.md` says backend checking of `x-internal-token` is a TODO. It is already done in `common/security/internal-proxy.ts`. The future-work lists in the docs also need a refresh.
- **Dispatch at scale.** The live map uses SVG and has no multi-stop route planning. `docs/dispatch-live-tracking.md` suggests switching to Mapbox GL above about 2,000 markers.

## Next steps

The first step is to push the branch. Then split it into reviewable PRs and run the checks that haven't been run yet.

- [ ] Push: `git push -u origin feat/crm-audit-gaps`
- [ ] Switch to Node 22 locally (`nvm use 22`) and re-run `pnpm lint typecheck test`
- [ ] Run `pnpm test:e2e` against a local stack
- [ ] Apply the 4 migrations to a fresh database with `pnpm db:migrate:deploy`, then run `pnpm db:seed:demo`
- [ ] Run `pnpm audit:rbac`, `pnpm qa:lifecycle` and `pnpm qa:chaos`
- [ ] Split into PRs. Suggested order:
  1. Domain schema and features (`cbb151d` through `392a646`)
  2. Security, finance and reliability audit fixes (`101471c` through `8940a96`)
  3. Build and CI (`1374aa0`)
  4. Lint-clean refactors, as one PR or one per app (`50691a7` through `c222fcb`)
- [ ] Set the 13 new env vars in staging and production, and add S3 credentials to the secret store
- [ ] Follow up separately: a `style:` PR that runs Prettier over the whole repo
- [ ] Follow up separately: fix the turbo `test` outputs warnings

## Reference

To see the full history, run `git log --oneline main..feat/crm-audit-gaps` (61 commits, newest first). Milestones in order:

| Range                 | Theme                                                                        |
| --------------------- | ---------------------------------------------------------------------------- |
| `c222fcb` … `50691a7` | Lint-clean pass (6 commits)                                                  |
| `1374aa0`             | Build: Docker, EAS, Node 22, e2e in CI                                       |
| `8940a96` … `101471c` | Security, finance, reliability, realtime and mobile audit fixes (14 commits) |
| `074bae2` … `5a06862` | Features, phone-size polish and earlier fixes (39 commits)                   |
| `cbb151d`             | Repair, growth, sales and productivity domain schema (first commit)          |

Useful commands:

```bash
pnpm turbo run lint typecheck test --continue   # full local gate
pnpm test:e2e                                   # Playwright
pnpm db:migrate:deploy && pnpm db:seed:demo     # fresh DB with demo data
pnpm audit:rbac                                 # route + permission audit
```

The conventions for this repo are in `AGENTS.md`. Pino log redaction paths are in `apps/api/src/common/logger/logger.module.ts`. Add new sensitive fields there.
