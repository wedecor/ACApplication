# Dispatch Engine + Technician Live Tracking

This module turns the platform into a real-time operations command center.
It is layered on top of the existing Lead + Booking foundation and shares
infrastructure (Prisma, Redis, Socket.io, NestJS event bus, React Query).

> If you are coming from `docs/lead-booking-engine.md`, this doc focuses on
> what happens **after** a booking exists: which technician runs it, how the
> dispatcher sees it, and how the field app reports back.

---

## 1. Architecture at a glance

```
┌────────────────────────────────────────────────────────────────────┐
│                          Admin CRM (Next.js)                       │
│   /dispatch  /live-map  ──►  React Query  ──►  socket.io  ──►  WS  │
└──────────────────────────────────▲─────────────────────────────────┘
                                   │   dispatch:* rooms
                                   │
┌──────────────────────────────────┴─────────────────────────────────┐
│                            NestJS API                              │
│                                                                    │
│  RoutingModule ──► MapProvider (Google / Mapbox / Haversine)       │
│      └─ RouteCache (Postgres)                                      │
│                                                                    │
│  TrackingModule ──► TechnicianLocation (history)                   │
│      └─ Redis GEO key  live:geo:{tenantId}:{cityId}                │
│      └─ HMAC signature + drift check                               │
│                                                                    │
│  TechnicianAvailabilityModule                                      │
│      └─ Status state-machine  +  TechnicianShift open/close        │
│                                                                    │
│  DispatchModule  (extends AssignmentService)                       │
│      └─ Smart scoring  +  DispatchAssignment audit                 │
│      └─ DispatchEvent  (alerts)                                    │
│                                                                    │
│  SlaMonitorModule (cron)                                           │
│      └─ stale techs, overdue bookings, delayed en-route,           │
│         low-availability, route-cache prune                        │
│                                                                    │
│  RealtimeGateway   ──►  dispatch:global, dispatch:city:{id},       │
│                          technician:{id}, booking:{id}             │
│                                                                    │
│  NotificationListener ─► WhatsApp / SMS / Push / Email             │
└──────────────────────────────────▲─────────────────────────────────┘
                                   │   POST /technicians/:id/location
                                   │   POST /technicians/:id/status
                                   │
┌──────────────────────────────────┴─────────────────────────────────┐
│                Technician App (Expo / React Native)                │
│   Status toggle  ──►  TaskManager  ──►  Offline queue              │
│                       (foreground + background)                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 2. Data model additions

| Model | Purpose | Hot indexes |
|-------|---------|-------------|
| `TechnicianLocation` | Append-only GPS history. | `(technicianId, recordedAt)`, `(latitude, longitude)` |
| `TechnicianAvailability` | Daily aggregate per tech (online min, accepted/rejected/completed, avg ratings, avg response/travel time). | `(technicianId, date)` unique |
| `TechnicianShift` | One open/close per online session. Auto-closed by SLA monitor on offline timeout. | `(technicianId, startedAt)` |
| `DispatchAssignment` | Audit row for every assignment decision (auto / manual / reassign / recommendation / rejection). | `(bookingId, createdAt)`, `(tenantId, decision, createdAt)` |
| `DispatchEvent` | Operational alerts surface (delayed tech, overdue booking, low availability, no candidates). | `(tenantId, acknowledgedAt, createdAt)` |
| `RouteCache` | TTL-keyed Google/Mapbox responses to avoid quota burn on the unassigned queue. | `(provider, expiresAt)` |
| `Technician` (extended) | `acceptanceRate`, `completionRate`, `dailyCapacity`, `onlineSince`, `lastSeenAt`, denormalised last-location columns, `locationSignKey`, `deviceFingerprint`. | `(tenantId, status, lastLocationAt)`, `(lastLatitude, lastLongitude)` |

State machines:

* `TechnicianStatus`: `OFFLINE → ONLINE → AVAILABLE ⇄ BUSY / EN_ROUTE / WORKING / ON_BREAK / UNREACHABLE`.
  Transitions are enforced server-side by `canTransitionTechnicianStatus`
  (see `@ac/types/enums`).
* `DispatchDecision`: append-only — every row is the source of truth for
  "why this tech for this job".

---

## 3. Smart dispatch scoring

The base `AssignmentService` scores on:

| Factor | Weight |
|--------|--------|
| Skill match (hard filter) | 40 |
| Proximity (Haversine) | 25 |
| Workload (active jobs around scheduledAt) | 20 |
| Rating | 15 |

`DispatchService` then layers **contextual** factors:

| Factor | Up to | How |
|--------|-------|-----|
| ETA (traffic-aware) | +20 | `RoutingService` (Google/Mapbox) linear decay 0 → 45 min |
| Recent response-time | +15 | `TechnicianAvailability.avgResponseTimeMin` |
| Repeat-customer preference | +10 | Tech has completed a prior job for this customer |
| Job priority boost | +18 | `EMERGENCY` > `PRIORITY` > `STANDARD` |
| Recently rejected | −∞ | Tech rejected this booking in the last 24h → excluded |

Auto-assign refuses to pick a candidate below `MIN_AUTO_SCORE` (55) and
surfaces the ranked recommendations instead — a "low confidence" decision
always falls back to a human dispatcher, never to a poor match.

---

## 4. Live tracking pipeline

1. **Tech app starts tracking** when the technician toggles online.
2. **Foreground:** `Location.startLocationUpdatesAsync` (15 s / 25 m, high accuracy).
3. **Background:** same API with `pausesUpdatesAutomatically: false` + an
   Android foreground service (notification visible).
4. Every ping is enqueued in **AsyncStorage** with an HMAC signature
   (per-device key issued at login). Max queue size = 500 (newest wins).
5. The queue flushes after every emit + on a 30 s timer. Failed flushes
   stay in the queue.
6. **Server-side ingest** (`POST /api/v1/technicians/:id/location`):
   * Validates signature (`LocationSigner.verify`).
   * Rejects pings drifted > 5 min (replay defence).
   * Validates device fingerprint when one is registered.
   * Bulk `createMany` into `technician_locations` + denormalises the
     latest position onto `technician`.
   * Writes Redis: `GEOADD live:geo:{tenantId}:{cityId} lng lat techId` +
     a hash with the freshest properties (TTL 10 min).
   * Emits `technician.location_updated` → `dispatch:global` +
     `technician:{id}` rooms.

The admin CRM live-map renders **denormalised columns + Redis geo
queries** — Postgres is the system-of-record but is never on the hot path.

---

## 5. Realtime rooms

| Room | Purpose | Members |
|------|---------|---------|
| `tenant:{tenantId}` | Catch-all per tenant. | Auto-joined on connect. |
| `user:{userId}` | Personal channel (assignments). | Auto-joined. |
| `dispatch:global` | Live ops feed — every dispatch / tracking event. | Dispatcher users. |
| `dispatch:city:{cityId}` | City-scoped alert feed. | City dispatchers. |
| `technician:{id}` | Per-tech channel — location, status, dispatch decisions. | Tech device + the assigned booking watchers. |
| `booking:{id}` | Per-job updates. | Customer app, dispatcher detail page. |
| `lead:{id}` | Per-lead updates. | Existing. |

---

## 6. API surface

### Tracking

| Method | Path | RBAC |
|--------|------|------|
| `POST` | `/api/v1/technicians/:id/location` | `technician:location:write` |
| `POST` | `/api/v1/technicians/:id/status` | `technician:status:write` |
| `GET`  | `/api/v1/technicians/live-map`   | `technician:track` |
| `GET`  | `/api/v1/technicians/availability` | `technician:track` |
| `GET`  | `/api/v1/technicians/:id/history` | `technician:track` |

### Dispatch

| Method | Path | RBAC |
|--------|------|------|
| `POST` | `/api/v1/dispatch/auto-assign/:bookingId` | `dispatch:assign` |
| `POST` | `/api/v1/dispatch/manual-assign` | `dispatch:assign` |
| `POST` | `/api/v1/dispatch/reassign` | `dispatch:override` |
| `GET`  | `/api/v1/dispatch/recommendations/:bookingId` | `dispatch:view` |
| `GET`  | `/api/v1/dispatch/unassigned` | `dispatch:view` |
| `GET`  | `/api/v1/dispatch/alerts` | `dispatch:view` |
| `POST` | `/api/v1/dispatch/alerts/:id/acknowledge` | `dispatch:acknowledge` |
| `GET`  | `/api/v1/dispatch/recent-decisions` | `dispatch:view` |

---

## 7. SLA monitor (cron)

| Cron | Action |
|------|--------|
| `* * * * *` (every 1m) | Sweep techs silent > 3 min → `UNREACHABLE`; > 30 min → `OFFLINE`. |
| `* * * * *` | Raise `BOOKING_OVERDUE` for bookings past scheduledAt + 15m grace. |
| `* * * * *` | Compute live ETA for `TECHNICIAN_EN_ROUTE` bookings; raise `TECHNICIAN_DELAYED` when projected arrival exceeds expectedAt + 10m. |
| `*/5 * * * *` | City-wide availability sweep — `LOW_AVAILABILITY` alert when < 20% of techs are dispatchable. |
| `*/5 * * * *` | Prune expired `route_cache` rows. |

Each cron is wrapped in a try/catch so one bad iteration cannot freeze the
pipeline. Alerts are **coalesced** on `(kind, resourceId)` to avoid the
operator drowning in duplicates.

---

## 8. Dispatcher dashboard UI

### `/dashboard/dispatch`

Three-column layout:

1. **Unassigned queue** — priority-sorted bookings, click-to-select.
2. **Recommendations** — top-N candidates with full score breakdown
   (base, ETA, response-time, repeat-customer, priority) + one-click
   manual-assign.
3. **Operational column** — availability KPI card, active alerts feed,
   live activity feed (last N dispatch decisions).

### `/dashboard/live-map`

Self-contained SVG live map (Mercator projection). Production swap for
Google Maps / Mapbox is a single component change in `live-map.tsx`.
Markers are colour-coded by status, with pulse animation for AVAILABLE
techs and an emergency pulse for EMERGENCY bookings. Heading is rendered
as a directional triangle. Selecting a technician opens a detail panel
with active job, battery, last-seen, rating.

Status filters surface live counts from `/technicians/availability`.

---

## 9. Technician mobile app

`apps/technician-app` is an Expo Router app. Two screens:

* **Home (`/`)** — status toggle (Available / Offline), today's jobs feed,
  flush-offline-queue button.
* **Active job (`/jobs/:id`)** — navigate (deep-link to Google Maps),
  send + verify customer OTP, status transitions (`on my way →
  arrived → in progress → waiting parts → complete`), reject job
  (auto-reassigns via dispatch engine), free-text notes.

Tracking lifecycle:

1. `registerLocationTasks()` runs on app boot, defining the two
   `TaskManager` handlers (foreground + background).
2. Going online: `startForegroundTracking()` + `startBackgroundTracking()`.
3. Going offline: `stopAllTracking()` + flush queue once more.
4. Every accepted ping is HMAC-signed using the per-device key stored in
   `expo-secure-store` (Keychain / EncryptedSharedPreferences).

---

## 10. Performance + scalability notes

* **Live map fan-out** — the gateway broadcasts to room subscriptions
  only; throttle is left to the client (RAF coalesce). For > 5k
  concurrent techs swap the SVG renderer for Mapbox GL JS native markers.
* **Redis as cache, not store** — keys carry TTLs; Postgres is the
  source-of-truth. A cold Redis just means dispatch falls back to the
  `lastLatitude / lastLongitude` columns + DB indexes.
* **Route cache** — Google / Mapbox API quotas dominate cost in
  production. The 5-minute TTL + coordinate-rounding (4 decimals ≈ 11 m)
  collapses ~80% of repeated dispatch lookups.
* **Cron isolation** — `SlaMonitorService` lives behind
  `@nestjs/schedule`. To run multi-node, replace with BullMQ + a
  Redis-backed scheduler so only one node fires each tick.

---

## 11. Security

* Signed location uploads + 5-min drift window → no replay.
* Device fingerprint check (when a fingerprint is registered).
* Rate-limit: per-route `@Throttle` (`/technicians/:id/location` is
  60 rps per IP).
* Realtime gateway requires a valid JWT on handshake.
* RBAC enforced at the controller layer + the WS gateway only emits
  events scoped to rooms a user has subscribed to.

---

## 12. Tests

| File | Scope |
|------|-------|
| `tracking/__tests__/location-signer.spec.ts` | HMAC sign / verify + clock-skew. |
| `routing/__tests__/haversine.provider.spec.ts` | Fallback ETA correctness. |
| `dispatch/__tests__/dispatch.service.spec.ts` | Recommendations, no-candidates, low-confidence, auto-assign. |
| `admin-crm/.../status-colors.test.ts` | Live-map palette completeness. |
| `technician-app/.../queue.test.ts` | Offline-queue trimming contract. |

---

## 13. Future evolution

* Replace the SVG live-map with **Mapbox GL** when the marker count
  grows past ~2 000 simultaneous.
* Swap the in-process `@nestjs/event-emitter` for **BullMQ** so dispatch
  + SLA monitor scale across nodes.
* Add **multi-stop route planning** (`MapProvider.route()`) to enable
  the "you have 4 jobs today, here's the optimal order" view in the
  technician app.
* Lean on **ML-based scoring** — the `DispatchAssignment.breakdown` rows
  are designed to be the training signal for a per-tenant learned model
  that adjusts weights over time.
