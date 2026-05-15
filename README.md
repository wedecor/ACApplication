# AC Platform

> Enterprise CRM + service operations platform for home-appliance repair.

A production-grade monorepo combining a customer-facing booking experience, internal CRM/dispatch console, technician field app, and a NestJS backend — built to scale across cities, channels, and teams.

Seven operational modules are implemented end-to-end on the foundational architecture:

1. **Lead Management + Booking Engine** — lead intake → qualification → conversion → technician dispatch → in-field workflow → completion, with timeline, RBAC, realtime updates and event-driven notifications. See [`docs/lead-booking-engine.md`](docs/lead-booking-engine.md).
2. **Dispatch Engine + Technician Live Tracking** — smart auto-assign + manual dispatch + reassignment with traffic-aware ETAs, live GPS map, dispatcher control center, SLA monitor, technician Expo app with offline-queued background GPS tracking. See [`docs/dispatch-live-tracking.md`](docs/dispatch-live-tracking.md).
3. **Financial Operations** — invoices (with CGST/SGST/IGST splits, banker's-rounded GST), quotations with public approval flow, Razorpay + Stripe payment links + webhook ingestion, AMC plans / subscriptions / visit calendar / renewals, technician commission accrual + payout cycles, customer ledger with running balance, branded PDF generation, and a Recharts analytics dashboard. See [`docs/financial-operations.md`](docs/financial-operations.md).
4. **Public Website + SEO Acquisition Engine** — premium homepage, programmatic SEO across (service × city × area) and (brand × service) matrices, MDX blog, Google Ads landing pages, multi-step booking funnel, WhatsApp conversion surfaces, GA4 / GTM / Meta Pixel analytics, JSON-LD structured data (Organization / LocalBusiness / Service / FAQ / Review / Article / Breadcrumb), programmatic sitemap + robots + manifest + OG image, plus a rate-limited public lead intake endpoint on the backend. See [`docs/public-website.md`](docs/public-website.md).
5. **Customer Mobile App** — Expo / React Native app for booking (multi-step flow with photo upload), Swiggy-style live technician tracking, hosted-checkout payments (Razorpay + Stripe), AMC membership management, invoices + PDF receipts, push notifications + WhatsApp fallback, support tickets, biometric unlock, device & session management, offline-cached dashboard, and a curated retry queue for low-stakes mutations. See [`docs/customer-app.md`](docs/customer-app.md).
6. **Inventory + Spare Parts ERP** — multi-warehouse stock, append-only inventory ledger with row-locked snapshots and weighted-average cost, vendor master + purchase orders + GRNs, inter-warehouse transfer state machine, technician van inventory (allocate → ack → use → return → reconcile), real-time alert engine (low / out-of-stock / expiring / slow-moving / overdue PO / shortfall), SKU + EAN-13 + QR codes, analytics (valuation, turnover, dead stock, wastage), and Admin CRM + technician-app surfaces. See [`docs/inventory-operations.md`](docs/inventory-operations.md).
7. **Omnichannel Support + Call Center + Ticketing** — Freshdesk / Zendesk-grade ticketing with merge / escalation / SLA timers, unified inbox spanning WhatsApp / email / phone / web-chat / in-app chat / SMS, WhatsApp Business hub (Cloud API webhooks, templates, delivery+read tracking), call center with click-to-call + missed-call queue (Exotel / Twilio / Knowlarity ready), website live-chat widget + customer-app chat thread, SLA & escalation engine with business-hour calendars, support analytics (CSAT, response/resolution times, channel mix), knowledge base, canned responses, AI extension hooks, agent-side customer context panel (bookings / AMC / payments / past tickets). See [`docs/omnichannel-support.md`](docs/omnichannel-support.md).

---

## Tech stack

| Layer            | Choice                                                           |
| ---------------- | ---------------------------------------------------------------- |
| Monorepo         | **Turborepo** + **pnpm workspaces**                              |
| Language         | **TypeScript** (strict, project references)                      |
| Frontend         | **Next.js 15** (App Router) + **React 18** + **Tailwind** + **Shadcn UI** + **Framer Motion** |
| Backend          | **NestJS 10** on **Fastify** + **Prisma 5** + **PostgreSQL 16** + **Redis 7** |
| Mobile           | **Expo 51** (React Native + Expo Router)                         |
| Realtime         | **Socket.io** with Redis pub/sub fan-out                         |
| Auth             | JWT (access + refresh, rotating) + OTP via SMS/WhatsApp + RBAC   |
| Observability    | **Pino** structured logs, **Sentry**, request-id correlation     |
| Testing          | **Vitest** + **Jest** + **React Testing Library** + **Playwright** |
| CI/CD            | **GitHub Actions** with Turborepo remote cache                   |

---

## Repository layout

```
ac-platform/
├── apps/
│   ├── api               · NestJS HTTP + WebSocket API
│   ├── web               · Next.js public marketing + customer booking site
│   ├── admin-crm         · Next.js internal CRM / dispatcher console
│   ├── technician-app    · Expo (RN) field-technician app
│   └── customer-app      · Expo (RN) customer app
├── packages/
│   ├── ui                · Tailwind preset + Shadcn-style component library
│   ├── database          · Prisma schema, generated client, soft delete, audit
│   ├── auth              · JWT / OTP / RBAC primitives (framework-agnostic)
│   ├── types             · Cross-app TS types, enums, API contracts, events
│   ├── config            · Zod-validated env, constants, feature flags
│   ├── analytics         · Provider-agnostic product telemetry
│   ├── notifications     · Multi-channel notification dispatcher
│   ├── whatsapp          · WhatsApp Business Cloud API client + webhooks
│   ├── payments          · Razorpay / Stripe payment gateway abstraction
│   ├── eslint-config     · Shared flat ESLint configs
│   └── typescript-config · Shared tsconfig presets
├── .github/workflows     · CI pipelines (lint, test, build, e2e)
├── docker-compose.yml    · Local Postgres + Redis + MailHog + MinIO
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

---

## Quick start

### 1. Prerequisites

- **Node.js** ≥ 20.11 (`nvm use` will pick up `.nvmrc`)
- **pnpm** ≥ 9.0 (`corepack enable && corepack prepare pnpm@9.12.0 --activate`)
- **Docker** + Docker Compose (for local Postgres / Redis)

### 2. Bootstrap

```bash
# 1) Install all workspace deps
pnpm install

# 2) Bring up local infra
docker compose up -d

# 3) Copy env templates and adjust as needed
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/admin-crm/.env.example apps/admin-crm/.env
cp packages/database/.env.example packages/database/.env

# 4) Generate Prisma client and apply migrations
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

### 3. Develop

```bash
# Start every app in parallel
pnpm dev

# Or run a single workspace
pnpm --filter @ac/api dev
pnpm --filter @ac/web dev
pnpm --filter @ac/admin-crm dev
pnpm --filter @ac/technician-app dev
pnpm --filter @ac/customer-app dev
```

Defaults:

| App         | URL                                       |
| ----------- | ----------------------------------------- |
| Marketing   | http://localhost:3000                     |
| Admin CRM   | http://localhost:3001                     |
| API         | http://localhost:4000/api/v1              |
| API docs    | http://localhost:4000/docs                |
| MailHog UI  | http://localhost:8025                     |
| MinIO UI    | http://localhost:9001 (`minioadmin/minioadmin`) |

---

## Architecture principles

1. **Strictly layered packages.** Apps import packages; packages never import apps. Packages form a DAG: `types → config → auth/ui/database → notifications/whatsapp/payments → apps`.
2. **Single source of truth for types.** Enums and DTO shapes live in `@ac/types`. Prisma owns the DB shape; everything else consumes plain TS from `@ac/types` to stay framework-neutral.
3. **Zero-trust env management.** No code path reads `process.env.X` directly — everything routes through Zod-validated loaders in `@ac/config` so a misconfigured deploy fails at boot, not in production.
4. **Audit by default.** The Prisma client is wrapped with soft-delete + audit-log extensions; every CRUD mutation on sensitive models is automatically recorded with the request actor.
5. **RBAC at the edge.** A global Nest guard enforces `@Public()` / `@Roles()` / `@RequirePermissions()` on every route. The permission matrix is seeded in the DB and mirrored in `@ac/auth` for offline use.
6. **Multi-tenant + multi-city ready.** Every operational table carries `tenantId` and references `City`. Adding a new city is a row insert; adding a new tenant is a one-row+seed operation.
7. **Realtime as a transport, not a feature.** `apps/api` exposes a typed Socket.io gateway. Domain services emit `DomainEvent` payloads to Redis pub/sub; the gateway fans them out to the right rooms.
8. **Money is integer minor units.** Never `Decimal` / `Float`. The Prisma schema and `Money` type both enforce this.

---

## Common scripts

```bash
pnpm dev              # All apps, parallel
pnpm build            # Build everything
pnpm lint             # ESLint across the monorepo
pnpm typecheck        # tsc --noEmit across all packages
pnpm test             # Unit tests
pnpm test:e2e         # Playwright e2e
pnpm format           # Prettier write
pnpm format:check     # Prettier verify
pnpm clean            # Wipe build artifacts + node_modules

# Database
pnpm db:generate      # Regenerate Prisma client
pnpm db:migrate       # Create + apply a new migration
pnpm db:studio        # Open Prisma Studio
pnpm db:seed          # Idempotent seed
pnpm db:reset         # Drop → migrate → seed
```

---

## Development workflow

1. **Branch:** `git checkout -b <type>/<scope>-<slug>` — types: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`.
2. **Code:** Modify or add packages first, apps consume them. Strict types are mandatory.
3. **Tests:** Every feature needs at least one unit test; cross-cutting changes need e2e coverage.
4. **Commits:** Conventional commits (`feat(api): …`). Husky + lint-staged run Prettier + ESLint on changed files.
5. **PR:** Use the template. CI must be green before review. Two approvals required to merge into `main`.
6. **Migrations:** Schema changes go through `pnpm db:migrate` locally; commit the generated `prisma/migrations/<ts>_<name>` folder.
7. **Env vars:** Document any new variable in the relevant `.env.example` **and** in the Zod schema in `@ac/config`.

### Adding a new domain feature

1. Define entities / enums in `@ac/types`.
2. Update Prisma schema in `@ac/database`; run `pnpm db:migrate`.
3. Add a NestJS module under `apps/api/src/modules/<domain>`:
   - `<domain>.module.ts`
   - `<domain>.controller.ts` (HTTP DTOs in `dto/`)
   - `<domain>.service.ts` (orchestration)
   - `<domain>.repository.ts` (Prisma access only)
4. Add API client helper(s) under `apps/web/src/lib/api/<domain>.ts` and `apps/admin-crm/src/lib/api/<domain>.ts`.
5. Wire UI in the appropriate app.

---

## Security checklist

- All secrets routed via `@ac/config` Zod schemas; no inline `process.env` reads.
- JWT refresh tokens persisted as SHA-256 hashes; rotation on every refresh.
- OTPs stored only as salted SHA-256 hashes, max-attempts + TTL enforced in Redis.
- Helmet, CORS allow-list, Fastify trust-proxy enabled in API.
- Throttling: global rate limit + tighter limits on auth endpoints.
- Pino redacts `authorization`, `cookie`, password, refresh tokens from logs.
- Soft delete + audit log on every sensitive table.
- WhatsApp & Razorpay webhooks verified with HMAC SHA-256 in constant time.

---

## License

UNLICENSED — internal use only.
