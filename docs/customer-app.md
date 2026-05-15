# Customer Mobile App

Expo / React Native client that gives customers a polished, Urban Company-grade
experience for booking AC, washing-machine, refrigerator and other appliance
repairs. The app reuses the existing API, auth, realtime, payments, AMC and
dispatch infrastructure - none of those systems are rebuilt here.

> Source: `apps/customer-app`

## Goals

- Trustworthy, premium feel from the first launch.
- Booking flow that completes in &lt; 60 seconds on a mid-tier Android.
- Live "Swiggy-style" technician tracking when a job is in progress.
- One-tap payments via Razorpay (UPI / cards) and Stripe (international).
- AMC retention surface (active plan, visits remaining, renewal prompts).
- Offline-tolerant: cached dashboards, queued mutations, optimistic updates.

## Stack

| Layer            | Choice                                                                 |
| ---------------- | ---------------------------------------------------------------------- |
| Runtime          | Expo SDK 51, React Native 0.74, React 18                               |
| Navigation       | Expo Router (file-based, typed routes)                                 |
| Data             | TanStack Query v5 + Zustand for ephemeral UI state                     |
| Style            | NativeWind (Tailwind for RN) + token primitives (`src/theme/tokens.ts`) |
| Realtime         | `socket.io-client` against the existing `/ws` gateway                   |
| Storage          | `expo-secure-store` for tokens; `@react-native-async-storage` for cache |
| Push             | Expo Notifications -> Expo push service                                |
| Maps             | `react-native-maps` (lazy loaded with a styled fallback)                |
| Forms            | `react-hook-form` (used inline where appropriate)                       |
| Biometric        | `expo-local-authentication`                                            |
| Network status   | `@react-native-community/netinfo`                                      |

## Folder layout

```
apps/customer-app
├── app/                      # Expo Router screens
│   ├── (auth)/               # welcome, login, OTP verify
│   ├── (tabs)/               # home, bookings, AMC, invoices, profile
│   ├── booking/[id].tsx      # detail + live tracking
│   ├── invoice/[id].tsx      # invoice detail + payment
│   ├── amc/[planId].tsx      # AMC plan purchase
│   ├── notifications.tsx     # inbox
│   ├── support.tsx           # tickets + chat shortcuts + FAQ
│   ├── profile/              # nested settings screens
│   ├── book.tsx              # multi-step booking flow
│   └── _layout.tsx           # root layout (auth gate, providers)
├── src/
│   ├── api/                  # typed endpoint surface + react-query keys
│   ├── components/           # UI primitives + feature components
│   ├── content/              # static catalogues (appliances)
│   ├── hooks/                # react-query / realtime composables
│   ├── lib/                  # api-client, secure-store, push, payments...
│   ├── state/                # zustand stores (auth, booking draft)
│   └── theme/                # design tokens
└── docs in repository: docs/customer-app.md (this file)
```

## Architecture

### Auth & session

`useAuthStore` (zustand) owns the customer session. On app start `_layout.tsx`
calls `hydrate()` which:

1. Pulls the access token from `expo-secure-store`.
2. Fetches `/v1/users/me` to refresh the cached profile.
3. Falls back to cached profile if the API is unreachable.

The API client (`src/lib/api-client.ts`) automatically attaches
`Authorization: Bearer <access>` and, on the first 401, transparently swaps it
for a freshly issued token via `/v1/auth/refresh`. If the refresh fails it
broadcasts an `onAuthLost` event which the auth store listens to to clear local
state and route back to `/login`.

OTP login supports both SMS and WhatsApp channels. The Verify screen autofills
the code on Android via `autoComplete="sms-otp"` and on iOS via
`textContentType="oneTimeCode"`.

`logoutAll()` calls `/v1/auth/logout-all` so refresh tokens for every device
are revoked server-side - critical for stolen/lost phone recovery.

### Booking flow

`app/book.tsx` is a single screen that progresses through six steps via the
`useBookingDraft` zustand store: `service → issue → photos → schedule →
address → review`. Photos are uploaded to S3 via presigned URLs returned by
`/v1/me/uploads/presign` - the app never sees AWS credentials.

The draft is deliberately in-memory only. Restarting the app cancels a partial
flow rather than presenting a stale draft.

Each step view emits a `booking_step_view` analytics event so the funnel can
be analysed end-to-end.

### Live tracking

`useTechnicianLocation(bookingId)` blends two sources of truth:

1. **Realtime push** - the gateway emits `technician.location` on the booking
   room (`booking:<id>`). The hook updates the react-query cache on each push.
2. **Polling fallback** - every 30s the hook hits
   `/v1/me/bookings/:id/technician/location` so we recover from socket
   blips, background suspensions or flaky networks.

`TrackingMap` lazy-imports `react-native-maps` so the bundle remains light on
platforms (and Expo Go) where the native module isn't available. A styled
"route ribbon" fallback keeps the screen useful even without a real map.

### Payments

Payments don't ship a checkout SDK. Instead the backend creates the order or
PaymentIntent and returns a **hosted checkout URL**. The app opens it in
`expo-web-browser`'s in-app browser, listens for the
`acplatform://pay/return` deep-link, then calls
`/v1/me/invoices/:id/pay/confirm` to surface the final status. This keeps:

- Razorpay UPI Intent flows working without extra integration.
- Bundle size low.
- The server as the source of truth for taxes, AMC offsets, refunds.

### Realtime

`src/lib/realtime.ts` wraps `socket.io-client`. One socket per app lifetime;
auto-reconnect with exponential backoff. The JWT is included via
`handshake.auth.token`. The gateway auto-joins `user:<id>` and `tenant:<id>`
rooms; the hooks join `booking:<id>` rooms on demand and leave them when the
component unmounts.

### Notifications

`src/lib/push.ts` handles Expo Push tokens. On login it requests permission
(only on physical devices), obtains an Expo push token, and posts it to
`/v1/notifications/devices`. Logging out calls the same endpoint with `DELETE`
so future pushes don't hit a dead session.

Foreground notifications invalidate the `notifications` query so the inbox
badge updates instantly.

### Offline & cache

- **Query persistence** - `src/lib/query-persistence.ts` persists a small,
  curated set of queries (bookings, invoices, AMC, addresses, notifications)
  to `AsyncStorage`. On boot they're rehydrated into the React Query cache so
  the app feels instant in the worst-network conditions.
- **Mutation queue** - `src/lib/offline-queue.ts` queues low-stakes,
  idempotent mutations (rate a booking, mark notification read) and drains
  them whenever connectivity returns.

### Security posture

- Tokens live in **Keychain (iOS)** and **EncryptedSharedPreferences (Android)**
  via `expo-secure-store`.
- Biometric unlock (`expo-local-authentication`) gates sensitive actions like
  signing out other devices.
- Per-device fingerprint (`src/lib/device.ts`) is sent on login so the server
  can list & revoke individual sessions.
- SSL pinning + screenshot protection plugins are wired in `app.json` ready
  for an EAS build profile when the security team turns them on.
- All API errors funnel through `ApiError` so screens surface a consistent
  message and analytics knows what went wrong.

## Adding a new screen

1. Drop the file under `app/` following Expo Router conventions.
2. Import primitives from `@/components/ui` and tokens from `@/theme/tokens`.
3. Use existing hooks (`useBookings`, `useInvoices`, etc.) rather than calling
   the API client directly - they share cache keys with the rest of the app.
4. If the screen mutates server state, prefer a hook in `src/hooks/use-*.ts`
   so the cache invalidations stay co-located.
5. For analytics-worthy interactions, push an event id to
   `src/lib/analytics.ts` and call `track(Events.X, { ... })`.

## Testing

```bash
pnpm -F @ac/customer-app test
```

Unit tests live next to their subjects under `__tests__/`. They cover:

- API client (auth headers, refresh-on-401, error wrapping)
- Secure store wrapper
- Format helpers
- Offline queue (drain order + retry behaviour)
- Booking draft store
- Appliance catalogue invariants

E2E flows (Maestro / Detox) are out of scope for this iteration and tracked
separately. The Jest preset is `jest-expo`, which configures the React Native
mocks and transforms NativeWind appropriately.

## Build & release

EAS handles native builds:

```bash
pnpm -F @ac/customer-app exec eas build --profile production --platform all
pnpm -F @ac/customer-app exec eas submit --profile production
```

Channel-based OTA updates ship through `eas update` once the binary is
published.

## Operational checklist

- [ ] Set `apiUrl`, `wsUrl`, support numbers in `app.json` (or EAS profile).
- [ ] Register Apple / Google push credentials in EAS.
- [ ] Provision a release-mode `expo-screen-capture` policy if you want to
      block screenshots on payment screens.
- [ ] Enable biometric unlock on staff devices used for in-store demos.
- [ ] Confirm `/v1/me/*` RBAC permissions are wired for the `CUSTOMER` role
      and that webhook reconciliation is healthy in payments.

## Roadmap

- React Native Maps with custom marker animations (smooth tween between
  realtime points).
- Native Razorpay Standard SDK to drop the in-app browser hop on Android.
- Detox e2e on staging.
- Visit checklist + photo capture for AMC service runs.
- Push categories (Action buttons: "Track", "Call pro", "Reschedule").
