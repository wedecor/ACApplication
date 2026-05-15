# Omnichannel Support & Call Center Module

The Omnichannel Support module is the customer-operations backbone of the AC
Platform — the equivalent of Freshdesk / Zendesk / Intercom fused with an
in-house WhatsApp Business hub and an Exotel / Twilio / Knowlarity-ready call
center. This document is the contract between backend, the Admin CRM, the
customer-app, the public website widget, and operations.

> **Philosophy.** *Every customer touch is a ticket.* WhatsApp messages,
> emails, phone calls, web-chat visitors and in-app chat threads are all
> persisted on a common `Conversation` row and stitched to a `SupportTicket`
> so SLA timers, CSAT, escalation chains and analytics work uniformly across
> channels.

---

## Module map

Backend (NestJS, in `apps/api/src/modules/support/`):

```
ai-hooks.service.ts            Sentiment / categorisation / reply-suggestion stubs
call-center.service.ts         Call logs, dispositions, recordings, click-to-call
call-center.controller.ts      Agent-facing call APIs + provider webhook
canned-responses.service.ts    Macros / quick replies
conversations.service.ts       Omnichannel ingest + outbound dispatcher
conversations.controller.ts    Inbox APIs (list / read / assign / send / typing)
customer-context.service.ts    Booking/AMC/invoice rollup for the agent sidebar
knowledge-base.service.ts      Categories + articles + public reader
knowledge-base.controller.ts   Agent & public KB controllers
live-chat.gateway.ts           Web-chat / in-app chat WebSocket gateway
me-support.controller.ts       Customer-facing /me/support/* endpoints
public-chat.controller.ts      Public REST proxy for the website widget
sla.service.ts                 SLA profile CRUD + scanner
sla.controller.ts              SLA profile APIs
support-analytics.service.ts   CSAT / response / channel / call-center metrics
support-scheduler.service.ts   Cron host that runs the SLA scanner
tickets.service.ts             Ticket lifecycle: create / assign / escalate / merge
tickets.controller.ts          Agent-facing ticket APIs
whatsapp-inbox.service.ts      Meta Cloud API webhook ingest
whatsapp.controller.ts         /webhooks/whatsapp endpoint (public)
support.notification-listener.ts  Fan-out of domain events to push/email/WA/SMS
support.module.ts              NestJS module wiring
```

Common helpers (`apps/api/src/common/support/`):

```
channels.ts    Channel ↔ TicketSource mapping, thread keys, preview generator
numbering.ts   nextSupportNumber() — advisory-locked TKT/CALL counters
sla.ts         computeDueDates / addBusinessMinutes / isOverdue
```

Admin CRM (`apps/admin-crm/src/`):

```
app/(dashboard)/support/         Overview dashboard (KPIs, SLA, channel mix)
app/(dashboard)/tickets/         List + detail pages
app/(dashboard)/inbox/           3-pane omnichannel inbox
app/(dashboard)/call-center/     Live call log + missed-call queue + click-to-call
app/(dashboard)/csat/            CSAT scoreboard + agent productivity
app/(dashboard)/knowledge-base/  Article authoring
app/(dashboard)/sla/             SLA profile management
app/(dashboard)/canned-responses/ Macro authoring
hooks/use-support.ts             Every React Query hook (single file)
lib/api/support.ts               Single typed REST client
```

Customer-facing surfaces:

```
apps/web/src/components/support/live-chat-widget.tsx       Public-website widget
apps/web/src/app/api/web-chat/                              Proxy routes for the widget
apps/customer-app/app/support.tsx                          Ticket list (existing)
apps/customer-app/app/support/[id].tsx                     New: in-app chat thread
apps/customer-app/src/hooks/use-support.ts                 Customer hooks
apps/customer-app/src/api/endpoints.ts                     supportApi.* additions
```

---

## Data model

All models live in `packages/database/prisma/schema.prisma`. They share the
project-wide conventions: CUID ids, `tenantId` scoping, `createdAt` /
`updatedAt` / `deletedAt` timestamps, and integer-minor money where money
appears.

| Model | Purpose |
| --- | --- |
| `SupportTicket` | Case header — ticket number, subject, status, priority, owner, SLA timers, CSAT. |
| `TicketMessage` | Agent-facing posts (replies + internal notes). Mirrors `ConversationMessage`. |
| `TicketAttachment` | File pointers — never the bytes; uses the shared upload store. |
| `TicketActivity` | Audit log: status changes, assignments, escalations, merges. |
| `Conversation` | Per-channel thread keyed on `(tenantId, channel, externalThreadKey)`. |
| `ConversationParticipant` | Customer / agent / bot membership. |
| `ConversationMessage` | Raw per-channel payloads, idempotent on `externalMessageId`. |
| `CallLog` | Phone-call lifecycle. Numbered `CALL-YYYY-NNNNNN`. |
| `CallRecording` | Pointer to provider-stored audio + duration + transcript stub. |
| `SLAProfile` | First-response + resolution targets with priority overrides. |
| `KnowledgeBaseCategory` / `KnowledgeBaseArticle` | Self-service help center. |
| `CannedResponse` | Quick-reply macros scoped global / team / private. |

Numbering uses Postgres advisory locks (`pg_advisory_xact_lock`) inside the
same transaction that writes the row — see `nextSupportNumber()`. Two
prefixes today: `TKT-` and `CALL-`.

---

## Ticket lifecycle

```
                       ┌──────────────┐
                       │     OPEN     │
                       └──────┬───────┘
        ┌────────────────────┬┴────────────────────────┐
        │                    │                         │
        v                    v                         v
   ┌────────┐         ┌──────────────┐         ┌──────────────┐
   │ PENDING│         │WAITING_CUST. │         │  ESCALATED   │
   └───┬────┘         └──────┬───────┘         └──────┬───────┘
       └──────────┬─────────┴────────┬───────────────┘
                  v                  v
            ┌──────────┐       ┌───────────┐
            │ ON_HOLD  │       │ RESOLVED  │──────┐
            └────┬─────┘       └─────┬─────┘      │
                 └────────┐          │            │
                          v          v            v
                                  ┌───────┐    (reopen → OPEN)
                                  │CLOSED │
                                  └───────┘
```

The state machine is defined in `packages/types/src/enums/index.ts` as
`TICKET_TRANSITIONS`. Use `canTransitionTicket(from, to)` rather than
hard-coding the table.

Side effects emitted on every transition (via `DomainEventBus`):

- `ticket.created`, `ticket.assigned`, `ticket.escalated`, `ticket.resolved`,
  `ticket.closed`, `ticket.reopened`, `ticket.first_response_recorded`,
  `ticket.sla_warning_emitted`, `ticket.sla_breached`,
  `ticket.priority_changed`, `ticket.csat_recorded`.
- These are bridged by `support.notification-listener.ts` to Notifications
  (push / email / WhatsApp / SMS) and by `realtime.gateway.ts` to the
  WebSocket rooms `support:global`, `ticket:<id>` and `user:<assigneeId>`.

---

## Omnichannel inbox

`ConversationsService.ingestInbound(envelope)` is the *single* entry-point
for every inbound message — WhatsApp, email, SMS, web-chat, in-app chat. The
adapter normalises into:

```ts
interface InboundMessageEnvelope {
  tenantId: string;
  channel: ConversationChannel;
  threadIdentifier: string;      // phone, email, session id…
  externalMessageId?: string;    // for idempotency
  body: string;
  customerLookupPhone?: string;
  customerLookupEmail?: string;
  fromName?: string;
  rawPayload?: Record<string, unknown>;
  occurredAt?: Date;
  ticketId?: string;             // when the adapter already knows
}
```

The service:
1. Deduplicates on `(tenant, channel, externalMessageId)`.
2. Resolves a Customer by phone/email when possible.
3. Lazily creates / re-uses the Conversation, keyed on
   `(tenantId, channel, externalThreadKey)`.
4. Lazily creates a SupportTicket for the conversation (so SLA timers
   start running immediately).
5. Persists the `ConversationMessage` and mirrors a `TicketMessage`.
6. Increments unread counters and flips
   `status=WAITING_CUSTOMER → OPEN` when the customer replies.
7. Emits `ConversationCreated`, `ConversationMessageReceived`, and
   `TicketCreated` events.

Outbound is `ConversationsService.sendOutbound(actor, input)`. It uses the
`NotificationsService` dispatcher under the hood, so WhatsApp / SMS / Email
go through their existing providers; web-chat falls back to gateway-only
broadcast. Provider IDs and failures are captured back onto the message row
(`externalMessageId`, `failureReason`).

### Channel adapters

| Channel | Adapter | Auth |
| --- | --- | --- |
| WhatsApp | `whatsapp-inbox.service.ts` + `WhatsAppClient` (`packages/whatsapp`) | `WHATSAPP_*` env, HMAC-validated webhook |
| Phone | `call-center.service.ts` + provider webhook | Shared-secret token |
| Email | `NotificationsService` dispatcher (outbound only — inbound goes through Postmark / Mailgun adapter, future) | Provider HMAC |
| Web chat | `live-chat.gateway.ts` (WebSocket) + `public-chat.controller.ts` (REST fallback) | Anonymous + rate-limited |
| In-app chat | Same `IN_APP_CHAT` channel, surfaced through `/me/support/*` | Customer JWT |
| SMS | Through `NotificationsService.SMS` provider | Provider HMAC |
| Social | Stubbed — extend via the same envelope pattern | n/a |

### Web-chat session lifecycle

The visitor widget can talk WebSocket via `LiveChatGateway` or fall back to
REST polling via `PublicWebChatController`. Both route through the *same*
`ingestInbound` codepath so the agent inbox is consistent.

REST endpoints (Next.js app proxies these so the browser never knows the
upstream URL):

```
POST /api/v1/public/web-chat/start                  → { sessionId, conversationId }
POST /api/v1/public/web-chat/:sessionId/messages    → { messageId }
GET  /api/v1/public/web-chat/:sessionId/messages    → { items: [...] }
```

Anti-abuse:

- Honeypot field `hp_url` — bots fill it, we silently accept and drop.
- Per-IP rate limits on the Next proxy (in-memory) and the NestJS
  `Throttle` decorator (Redis-backed).
- Sessions are kept in `localStorage` under `ac.web-chat.sid` so a hard
  refresh keeps the conversation.

---

## SLA & escalation

`SLAProfile` rows store first-response and resolution targets with per-
priority overrides. The `SupportSchedulerService` runs a cron tick every
minute, calling `SlaService.scanTenant(tenantId)` for each active tenant:

1. Find tickets whose `firstResponseDueAt` or `resolutionDueAt` is within
   the warning window (`warningWindowMinutes`, capped at 60).
2. Emit `ticket.sla_warning_emitted` and bump
   `firstResponseWarningSentAt` so we don't spam.
3. Find tickets whose due-by has passed → emit
   `ticket.sla_breached` and (if configured) auto-escalate one level.

Business-hour SLAs use `addBusinessMinutes()` which skips Sundays and
clamps to a 9 AM – 6 PM window. For richer holiday calendars, swap that
helper for a tenant-specific implementation.

---

## Call center

`CallCenterService` is provider-agnostic and supports Exotel, Twilio, and
Knowlarity-shaped webhooks. The flow:

1. Provider posts to `/webhooks/calls/:provider` (public, secret-token).
2. We call `startCall(tenantId, dto)` → persists a `CallLog` row, idempotent
   on `(provider, externalCallId)`.
3. The agent UI subscribes to `support:global` and receives a `CallIncoming`
   event, then pops the call drawer with customer context.
4. Subsequent webhooks call `updateStatus`, then `setDisposition` when the
   agent wraps up.
5. Click-to-call from the CRM uses `clickToCall()` which creates an
   outbound `CallLog` row and triggers the provider's place-call API.

Missed calls (`MISSED`, `NO_ANSWER`, `BUSY`, `ABANDONED`) flow into the
`Missed call queue` widget on `/call-center` — agents can call back with
one tap.

---

## Knowledge base

- `KnowledgeBaseCategory` + `KnowledgeBaseArticle`.
- Visibility: `PUBLIC`, `CUSTOMER_AUTHENTICATED`, `INTERNAL`.
- Status: `DRAFT`, `PUBLISHED`, `ARCHIVED`.
- Public reader: `GET /api/v1/public/kb/articles/:tenantId/:slug` — increments
  `viewCount` and is safe to cache aggressively.
- Feedback: `POST /api/v1/public/kb/articles/:tenantId/:id/feedback` →
  `helpfulCount` / `notHelpfulCount`.

---

## RBAC

Permissions live in `packages/types/src/enums/index.ts` and are seeded by
`packages/database/src/seed/index.ts`:

```
support:view          ticket:view           inbox:view
ticket:create         ticket:update         ticket:assign
ticket:escalate       ticket:close          ticket:reopen
ticket:merge          ticket:delete
inbox:manage          conversation:view     conversation:reply
conversation:assign
call:view             call:start            call:manage
kb:view               kb:write              kb:publish
canned:manage         sla:manage            support:analytics
```

Default role mapping is in `DEFAULT_ROLE_PERMISSIONS` (see
`packages/auth/src/rbac/index.ts`). Customers can read & create their own
tickets through the `/me/support/*` controller, which scopes every query to
`customerId = current user's customer.id`.

---

## Realtime

`realtime.gateway.ts` exposes Socket.IO on `/ws` (same gateway as the rest
of the platform). Subscribable rooms:

- `support:global` — all support events (used by the inbox dashboard).
- `ticket:<id>` — fine-grained subscription per ticket.
- `conversation:<id>` — per-thread events (messages, typing, read).
- `support:sla` — SLA warnings and breaches.
- `user:<userId>` — automatically joined on connect; carries assignment
  pings.

Events broadcast:

| Source domain event | Socket.IO event | Notes |
| --- | --- | --- |
| `ticket.created` | `ticket.created` | Fan-out to `support:global` |
| `ticket.assigned` | `ticket.assigned` | Also DM'd to `user:<assignee>` |
| `conversation.message_received` | `conversation.message` | Live inbox refresh |
| `conversation.typing` | `conversation.typing` | Ephemeral |
| `call.incoming` | `call.incoming` | Triggers agent drawer |
| `ticket.sla_breached` | `ticket.sla_breach` | Alerts managers |

---

## Notifications

`SupportNotificationListener` listens for support events and fans them out
through `NotificationsService.dispatch()`:

| Event | Channels | Default template key |
| --- | --- | --- |
| `ticket.created` | Email + WhatsApp (customer-facing) | `support.ticket.created` |
| `ticket.assigned` | Push + In-app (agent-facing) | `support.ticket.assigned` |
| `ticket.escalated` | Email + Push (managers) | `support.ticket.escalated` |
| `ticket.sla_warning_emitted` | Push (assignee) | `support.sla.warning` |
| `ticket.sla_breached` | Email + Push (managers) | `support.sla.breach` |
| `conversation.message_received` | Push (assignee) | `support.message.received` |
| `call.missed` | Push + WhatsApp (customer apology) | `support.call.missed` |

Templates live in the existing `@ac/notifications` template registry. Add
new ones there; no code changes needed in the listener.

---

## Customer context panel

`GET /api/v1/support/tickets/:id/customer-context` rolls up:

- Customer profile (name, phone, email, value score)
- Bookings (status, dates, totals)
- AMC subscriptions
- Invoices + recent payments
- Last 5 closed tickets

The `valueScore` is a quick aggregation of paid invoice totals + AMC
status. It exists to surface VIPs to the agent — not for billing.

---

## AI extension hooks

`SupportAiHooksService` is a thin shim with four entry points designed to
be backed by an LLM provider (OpenAI / Anthropic / OSS):

- `analyseSentiment(conversationId)`
- `categoriseTicket(ticketId)`
- `suggestReplies(conversationId, count)`
- `summariseConversation(conversationId)`

They currently return safe fallbacks. Wire an actual provider by replacing
the implementations — no callers need to change.

---

## Endpoints (TL;DR)

Agent-facing (`@ApiBearerAuth`, JWT, RBAC-gated):

```
GET    /api/v1/support/tickets
POST   /api/v1/support/tickets
GET    /api/v1/support/tickets/:id
PATCH  /api/v1/support/tickets/:id
DELETE /api/v1/support/tickets/:id
POST   /api/v1/support/tickets/:id/assign
POST   /api/v1/support/tickets/:id/escalate
POST   /api/v1/support/tickets/:id/status
POST   /api/v1/support/tickets/:id/resolve
POST   /api/v1/support/tickets/:id/close
POST   /api/v1/support/tickets/:id/reopen
POST   /api/v1/support/tickets/:id/merge
POST   /api/v1/support/tickets/:id/notes
POST   /api/v1/support/tickets/:id/reply
POST   /api/v1/support/tickets/:id/attachments
POST   /api/v1/support/tickets/:id/csat
GET    /api/v1/support/tickets/:id/activities
GET    /api/v1/support/tickets/:id/messages
GET    /api/v1/support/tickets/:id/customer-context

GET    /api/v1/support/inbox/conversations
GET    /api/v1/support/inbox/conversations/:id
GET    /api/v1/support/inbox/conversations/:id/messages
POST   /api/v1/support/inbox/conversations/:id/assign
POST   /api/v1/support/inbox/conversations/:id/messages
POST   /api/v1/support/inbox/conversations/:id/read
POST   /api/v1/support/inbox/conversations/:id/typing
POST   /api/v1/support/inbox/conversations/:id/close

GET    /api/v1/support/calls
GET    /api/v1/support/calls/missed-queue
POST   /api/v1/support/calls/click-to-call
POST   /api/v1/support/calls/:id/disposition

GET    /api/v1/support/sla/profiles
POST   /api/v1/support/sla/profiles
PUT    /api/v1/support/sla/profiles/:id
POST   /api/v1/support/sla/scan

GET    /api/v1/support/kb/categories
POST   /api/v1/support/kb/categories
GET    /api/v1/support/kb/articles
POST   /api/v1/support/kb/articles
PATCH  /api/v1/support/kb/articles/:id

GET    /api/v1/support/canned-responses
POST   /api/v1/support/canned-responses

GET    /api/v1/support/analytics/overview
GET    /api/v1/support/analytics/response-times
GET    /api/v1/support/analytics/agent-productivity
GET    /api/v1/support/analytics/channel-breakdown
GET    /api/v1/support/analytics/call-center
```

Customer-facing (`@ApiBearerAuth`, customer JWT, scoped to my data):

```
GET    /api/v1/me/support/tickets
POST   /api/v1/me/support/tickets
GET    /api/v1/me/support/tickets/:id
GET    /api/v1/me/support/tickets/:id/messages
POST   /api/v1/me/support/tickets/:id/messages
POST   /api/v1/me/support/tickets/:id/csat
```

Public (unauthenticated, throttled):

```
GET    /api/v1/public/kb/articles/:tenantId/:slug
POST   /api/v1/public/kb/articles/:tenantId/:id/feedback
POST   /api/v1/public/web-chat/start
GET    /api/v1/public/web-chat/:sessionId/messages
POST   /api/v1/public/web-chat/:sessionId/messages
GET    /webhooks/whatsapp                             (Meta subscription verify)
POST   /webhooks/whatsapp                             (HMAC-validated)
POST   /webhooks/calls/:provider                      (shared-secret)
```

---

## Testing

Unit tests live next to the code:

- `apps/api/src/common/support/__tests__/sla.spec.ts`
- `apps/api/src/common/support/__tests__/channels.spec.ts`
- `apps/api/src/common/support/__tests__/numbering.spec.ts`
- `apps/api/src/modules/support/__tests__/whatsapp-inbox.service.spec.ts`
- `packages/types/src/__tests__/ticket-transitions.spec.ts`

Run with:

```bash
pnpm --filter @ac/api test
pnpm --filter @ac/types test
```

For end-to-end webhook tests, drop a fixture under
`apps/api/test/fixtures/whatsapp/*.json` and call
`WhatsAppInboxService.handleWebhook(fixture)` in a service spec — the
service already has a dependency-free public surface.

---

## Operational runbook

| Symptom | Where to look |
| --- | --- |
| Inbound WhatsApp messages not appearing in inbox | `WHATSAPP_*` env vars set? Meta dashboard webhook delivery log. `whatsapp-inbox.service.ts` logs at WARN when secret missing. |
| SLA timers aren't firing | `SupportSchedulerService` runs every minute. Check pods log for `scanTenant`. Verify the ticket has a `slaProfileId` (or a default profile). |
| Outbound replies stuck in `QUEUED` | `ConversationMessage.failureReason` will show the provider error. Notifications service requires `WHATSAPP_ACCESS_TOKEN`, `SMS_PROVIDER_*`, `EMAIL_PROVIDER_*` as relevant. |
| Web chat widget loops on poll | `lastFetchedRef` advances on each tick; if it's stuck the session id is wrong — clear `ac.web-chat.sid` from devtools. |
| Click-to-call never connects | `CALL_CENTER_FROM_NUMBER` + `CALL_CENTER_PROVIDER` env vars. The call row will sit in `QUEUED` until the provider's webhook flips it to `RINGING`. |

---

## Future work

- Full email-inbound adapter (Postmark / Mailgun / SES).
- Voice-to-text for `CallRecording.transcript`.
- Multi-agent assignment (currently single assignee).
- Holiday calendar support in `addBusinessMinutes()`.
- AI hook implementations against OpenAI + a local OSS fallback.
