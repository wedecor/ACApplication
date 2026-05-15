# Architecture

This document describes the technical architecture of the AC Platform foundation. It explains how requests flow through the system, where state lives, and how new features should be added.

## High-level view

```
                ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐
   Customer ──▶ │  web         │    │ admin-crm    │ ◀── Operations team
   (Web)        │  Next.js 15  │    │  Next.js 15  │
                └──────┬───────┘    └──────┬───────┘
   Customer/Tech ──▶ ┌────────────┐ ┌──────────────┐
   (Mobile)          │ customer-  │ │ technician-  │
                     │ app (Expo) │ │ app (Expo)   │
                     └─────┬──────┘ └─────┬────────┘
                           │              │
                           └──────┬───────┘
                                  ▼
                          ┌───────────────┐         ┌─────────────┐
                          │   apps/api    │ ──────▶ │ Postgres 16 │
                          │  NestJS +     │ ──────▶ │ Redis 7     │
                          │  Fastify +    │ ──────▶ │ S3 / MinIO  │
                          │  Prisma 5     │ ──────▶ │ Sentry      │
                          └──────┬────────┘
                                 │
                       Socket.io │WebSockets
                                 ▼
                     Realtime fan-out to web + mobile
```

## Package graph

Packages form a strict DAG (no cycles):

```
typescript-config ─┐
                   ├──▶ All packages
eslint-config ─────┘

types ──▶ config ──▶ auth ──▶ database
                      │          │
                      ├──▶ ui    │
                      │          │
notifications ──▶ whatsapp       │
              ├──▶ payments      │
              └────────────┬─────┘
                           ▼
                          apps
```

Rules:

- Apps import packages, never the other way around.
- Within `packages/`, lower-level packages (`types`, `config`) MUST NOT import higher-level ones.
- UI is a leaf for the React side; it depends only on `types` for shared enums.

## Request lifecycle (API)

```
1. Fastify receives request
2. CLS middleware mounts a request-scoped store
3. TracingInterceptor sets `x-request-id`, populates CLS
4. ThrottlerGuard enforces global + endpoint-specific limits
5. JwtAuthGuard validates Bearer token → attaches AuthPrincipal
6. RolesGuard validates @Roles() / @RequirePermissions()
7. ValidationPipe parses & validates the DTO
8. Controller delegates to Service → Repository → Prisma
9. ResponseInterceptor wraps the payload in ApiSuccess envelope
10. (On error) GlobalExceptionFilter converts to ApiError envelope
```

Pino logs include `requestId`, `userId`, `tenantId`, `path`, `statusCode`, `latencyMs`.

## Auth flow

```
A. Request OTP
   POST /api/v1/auth/otp/request { destination }
     → OtpService.issue() generates code, stores SHA-256(code, pepper)
       in Redis with TTL & attempt counter, dispatches via SMS/WhatsApp transport.

B. Verify OTP
   POST /api/v1/auth/otp/verify { destination, code }
     → OtpService.verify() compares hash in constant time.
     → On success: upsert User, create Session row, mint access + refresh
       tokens. Refresh token persisted as SHA-256 hash for rotation.

C. Authenticated request
   Authorization: Bearer <access>
     → JwtAuthGuard verifies signature, issuer, audience, expiry.
     → AuthPrincipal { userId, tenantId, roles, permissions } attached.

D. Refresh
   POST /api/v1/auth/refresh { refreshToken }
     → Verify JWT signature, then look up Session by SHA-256 hash.
     → If revoked or rotated → 401. Else issue new pair + rotate.

E. Logout
   POST /api/v1/auth/logout
     → Mark session.revokedAt = now(). Future access tokens still valid until
       they expire (≤ 15 min by default). For immediate revocation we keep a
       Redis denylist keyed by session id.
```

## RBAC

Three tiers, evaluated in order:

1. **Wildcard** (`*`) — `SUPER_ADMIN` only.
2. **Permissions** — fine-grained `<resource>:<action>` keys (e.g. `booking:assign`).
3. **Role outranking** — used when a route specifies `@Roles(UserRole.ADMIN)`; any caller whose highest role outranks the required role passes.

Role → permission mapping lives in:

- `packages/auth/src/rbac/index.ts` — typed fallback for tests + offline tools.
- `packages/database/src/seed/index.ts` — authoritative DB seed (`roles`, `permissions`, `role_permissions`).

## Multi-tenancy

Every operational row carries `tenantId`. We resolve the tenant from:

1. JWT claim `tid` (for authenticated calls).
2. `X-Tenant-Slug` header (for public endpoints like signup).
3. A default tenant (`default`) for development.

The Prisma audit extension reads the actor from CLS (`tenantId` + `userId`) so audit rows always attribute the right tenant even for system jobs.

## Realtime

Socket.io gateway rooms:

- `tenant:{tenantId}` — broadcast scope
- `user:{userId}` — personal channel
- `dispatch:{cityId}` — ops dashboard feed
- `technician:{technicianId}` — field-app channel
- `lead:{leadId}` — per-lead detail page
- `booking:{bookingId}` — per-job tracking

Domain services publish typed `DomainEvent<T>` payloads via `DomainEventBus`. In multi-instance deployments, Redis pub/sub fans events across nodes (configured in `EventsModule`). The realtime gateway, audit log, and notifications module all subscribe via `@OnEvent('lead.*' | 'booking.*')`. See `docs/lead-booking-engine.md` for the full event catalogue.

## Data integrity

- **Soft delete** — every domain table has `deletedAt`. Reads filter it out by default; the Prisma extension rewrites `delete*` → `update*`.
- **Audit log** — `audit_logs` row written for every CREATE/UPDATE/DELETE on sensitive models, with before/after JSON.
- **Money** — stored as integer minor units (`paise`). UI formats with `Intl.NumberFormat`. Never use float math for money.
- **Migrations** — generated by Prisma; reviewed in PR; applied in CI via `migrate:deploy`.

## Future evolution

- **Microservices.** The current modular monolith can be split along bounded contexts (auth, bookings, payments) by promoting the existing `*.module.ts` files to dedicated Nest microservices. The shared packages (`@ac/types`, `@ac/auth`, `@ac/database`) make this a straightforward extraction.
- **Read replicas.** Repositories isolate Prisma access — swap in a read-only client for reporting queries without touching service code.
- **Event sourcing.** `audit_logs` + `domain events` provide the substrate; future analytics pipelines can replay from there.
- **GraphQL gateway.** REST is canonical today. Adding GraphQL via Apollo over the same modules is a stepwise refactor (no schema duplication thanks to `@ac/types`).
