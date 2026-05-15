# Lead Management + Booking Engine

This module is the operational heart of the AC Platform CRM. It captures
incoming customer enquiries (leads), qualifies them, converts them into
scheduled service bookings, dispatches a technician, tracks the job to
completion, and emits domain events the rest of the stack listens on.

```
Lead created → Contacted → Qualified
                                 ↓ convert
                              Booking PENDING
                                 ↓ assign
                              ASSIGNED → TECHNICIAN_EN_ROUTE
                                 ↓ OTP verified
                              IN_PROGRESS ↔ WAITING_PARTS
                                 ↓
                              COMPLETED → Invoice
```

## High-level architecture

```
                  ┌────────────────────────┐
                  │   Admin CRM (Next.js)  │
                  │  TanStack Table + RQ   │
                  └──────┬─────────┬───────┘
                         │ HTTP    │ WS
                         ▼         ▼
                  ┌──────────────────────────────┐
                  │       NestJS API             │
                  │                              │
                  │  LeadsController             │
                  │  BookingsController          │
                  │  RealtimeGateway             │
                  │       │                      │
                  │       ▼                      │
                  │  LeadsService / BookingsSvc  │
                  │       │                      │
                  │       ▼                      │
                  │  ActivityService             │
                  │  AssignmentService           │
                  │  DomainEventBus  ─► Redis    │
                  │       │                      │
                  │       ▼                      │
                  │  NotificationListener        │
                  │  RealtimeGateway (subscribed)│
                  └──────┬───────────────────────┘
                         ▼
                  ┌─────────────────────┐
                  │ Postgres (Prisma)   │
                  │  - leads, lead_*    │
                  │  - bookings, b_*    │
                  │  - audit_logs       │
                  └─────────────────────┘
```

## Modules

| Module                | Responsibility                                                    |
| --------------------- | ----------------------------------------------------------------- |
| `LeadsModule`         | Lead CRUD, state machine, notes, timeline, idempotent intake      |
| `BookingsModule`      | Booking CRUD, status transitions, OTP, reschedule, signatures     |
| `AssignmentModule`    | Smart scoring (skills × proximity × workload × rating)            |
| `ActivityModule`      | Shared timeline writer for both leads & bookings                  |
| `NotificationsModule` | Listens on domain events, dispatches WhatsApp/SMS/email/push      |
| `RealtimeModule`      | Socket.io rooms per tenant / lead / booking / technician          |
| `EventsModule`        | Strongly-typed `DomainEventBus` (in-process emit + Redis fan-out) |

## Data model additions

```
Lead ──┐                     ┌── Booking ─┬── BookingActivity
       ├── LeadNote          │             ├── BookingNote
       └── LeadActivity      │             └── BookingAttachment
                             └── (FK on Lead.bookingId, 1:1)
```

All tables carry:

- `tenantId` for multi-tenancy isolation,
- soft-delete (`deletedAt`) routed through the Prisma extension,
- `createdBy` / `updatedBy` / `deletedBy` filled transparently from
  `nestjs-cls` actor context.

## State machines

### Lead

```
NEW ─► CONTACTED ─► QUALIFIED ─► BOOKING_CREATED ✓
  │       │             │
  └───► CANCELLED / SPAM (terminal)
```

Transitions are validated by `canTransitionLead()` in `@ac/types`.

### Booking

```
DRAFT ─► PENDING ─► CONFIRMED ─► ASSIGNED ─► TECHNICIAN_EN_ROUTE
                                                     │
                                                     ▼
                              ┌──── WAITING_PARTS ◄─► IN_PROGRESS
                              │              ▲
                              ▼              │
                          COMPLETED ✓        │
                              ▲              │
                              └──────────────┘
```

`CANCELLED`, `NO_SHOW`, and `RESCHEDULED` are reachable from most non-terminal
states; the matrix lives in `BOOKING_TRANSITIONS` and is enforced by
`BookingsService.changeStatus()`.

## Assignment engine

```
score = skillMatch (40) + proximity (25) + workload (20) + rating (15)
```

- Hard filters: same city, `AVAILABLE` status, has the required skill,
  not in the excluded set, no overlapping booking in ±2h.
- Soft scoring: weighted sum (see `AssignmentService` constants).
- `pickBest()` auto-picks when `score ≥ MIN_AUTO_SCORE` (55), otherwise
  surfaces the ranked list to the dispatcher for manual review.

The `breakdown` returned by `findCandidates()` powers the dispatcher's
"why this technician" tooltip in the UI.

## Domain events

| Event                       | Emitter                          | Consumers                                    |
| --------------------------- | -------------------------------- | -------------------------------------------- |
| `lead.created`              | `LeadsService.create`            | Realtime, audit                              |
| `lead.assigned`             | `LeadsService.assign`            | Realtime, NotificationListener (in-app + email) |
| `lead.status_changed`       | `LeadsService.changeStatus`      | Realtime                                     |
| `lead.converted`            | `BookingsService.createFromLead` | Analytics                                    |
| `booking.created`           | `BookingsService.create`         | Customer confirmation (WhatsApp + email)     |
| `booking.assigned`          | `BookingsService.assignTechnician` | Customer + technician notifications         |
| `booking.status_changed`    | `BookingsService.changeStatus`   | Realtime, audit                              |
| `booking.otp_sent`          | `BookingsService.sendArrivalOtp` | OTP delivery via SMS / WhatsApp              |
| `booking.completed`         | `BookingsService.changeStatus`   | Customer "thank you" + invoice trigger       |
| `booking.rescheduled`       | `BookingsService.reschedule`     | Customer rebooking notice                    |
| `booking.cancelled`         | `BookingsService.changeStatus`   | Customer + technician notifications          |

Events fan out over Redis Pub/Sub so any node in the cluster (and any
external worker) can react.

## Realtime channels

- `tenant:{tenantId}` — global tenant feed (super-admins / analytics).
- `dispatch:{cityId}` — ops dashboard live feed (filterable by city).
- `lead:{leadId}` — joined automatically when a CRM user opens a lead.
- `booking:{bookingId}` — joined on the booking detail screen.
- `technician:{technicianId}` — field app channel.

Clients send `subscribe` / `unsubscribe` messages with the rooms they want
to follow; the gateway enforces RBAC (user can only join `user:{their id}`
and `tenant:{their tenant}`).

## API surface

### Leads

| Method | Path                       | Permission         |
| ------ | -------------------------- | ------------------ |
| POST   | `/api/v1/leads`            | `lead:create`      |
| GET    | `/api/v1/leads`            | `lead:view`        |
| GET    | `/api/v1/leads/:id`        | `lead:view`        |
| PATCH  | `/api/v1/leads/:id`        | `lead:update`      |
| POST   | `/api/v1/leads/:id/assign` | `lead:assign`      |
| POST   | `/api/v1/leads/:id/status` | `lead:update`      |
| POST   | `/api/v1/leads/:id/notes`  | `lead:update`      |
| GET    | `/api/v1/leads/:id/notes`  | `lead:view`        |
| GET    | `/api/v1/leads/:id/activities` | `lead:view`    |

### Bookings

| Method | Path                                       | Permission              |
| ------ | ------------------------------------------ | ----------------------- |
| POST   | `/api/v1/bookings`                         | `booking:create`        |
| POST   | `/api/v1/bookings/from-lead/:leadId`       | `booking:create` + `lead:update` |
| GET    | `/api/v1/bookings`                         | `booking:read`          |
| GET    | `/api/v1/bookings/:id`                     | `booking:read`          |
| PATCH  | `/api/v1/bookings/:id`                     | `booking:update`        |
| POST   | `/api/v1/bookings/:id/assign-technician`   | `booking:assign`        |
| POST   | `/api/v1/bookings/:id/status`              | `booking:update`        |
| POST   | `/api/v1/bookings/:id/reschedule`          | `booking:reschedule`    |
| POST   | `/api/v1/bookings/:id/otp/send`            | `booking:update`        |
| POST   | `/api/v1/bookings/:id/verify-otp`          | `booking:update`        |
| POST   | `/api/v1/bookings/:id/notes`               | `booking:update`        |
| POST   | `/api/v1/bookings/:id/attachments`         | `booking:update`        |
| POST   | `/api/v1/bookings/:id/signature`           | `booking:update`        |
| GET    | `/api/v1/bookings/:id/activities`          | `booking:read`          |

All list endpoints support: `page`, `pageSize`, `search`, multi-value
filters (CSV), `sort=field:dir,field:dir`.

## Frontend pages

| Route                       | Description                                            |
| --------------------------- | ------------------------------------------------------ |
| `/leads`                    | TanStack Table, multi-facet filters, debounced search  |
| `/leads/[id]`               | Tabbed details: timeline, notes, full lead metadata    |
| `/bookings`                 | Operational scheduler view, status + payment filters   |
| `/bookings/[id]`            | Timeline, status actions, OTP verify, reschedule form  |

The `useRealtime` hook subscribes to relevant rooms and invalidates the
React Query cache whenever a domain event arrives, giving the dispatcher
auto-refreshing UI without page reloads.

## Performance

- Postgres indexes on `(tenantId, status, createdAt)`, `(tenantId, cityId, status)`,
  `(assignedUserId, status)`, `(phone)` for leads.
- Bookings indexed on `(tenantId, status, scheduledAt)`, `(technicianId, status)`,
  `(cityId, scheduledAt)`, `(tenantId, paymentStatus)`.
- All list queries paginate (max page size 100) and run a single
  `$transaction` for `findMany + count`.
- React Query uses `keepPreviousData` to avoid pagination flicker.
- Debounced search (250 ms) on both leads and bookings filter bars.

## Testing

- Unit: `LeadsService` (`apps/api/src/modules/leads/__tests__`) and
  `AssignmentService` (`apps/api/src/modules/assignment/__tests__`).
- HTTP/e2e: `apps/api/test/leads.e2e-spec.ts` boots the Nest app under
  Fastify with permissive guards.
- Component: `LeadStatusBadge` (`apps/admin-crm/src/components/leads/__tests__`)
  runs under Vitest + React Testing Library.

Run everything via the monorepo:

```bash
pnpm test
```

## Future evolution

- Replace `ConsoleTransport` with `WhatsAppCloudClient`, `TwilioSmsTransport`,
  `SesEmailTransport`, `FcmTransport`. Listener wiring is unchanged.
- Promote `AssignmentService.MIN_AUTO_SCORE` and weights to a feature-flag
  so weights are tunable per city.
- Outbox pattern: persist `domain_events` rows before fan-out so Redis
  failures never lose events.
- Migrate `Lead` → `Customer` linking + de-dupe to a dedicated
  `IdentityResolutionService` once phone-number normalisation expands
  beyond E.164.
