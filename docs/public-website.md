# Public Website & SEO Acquisition Engine

The `apps/web` workspace is the customer-facing acquisition surface for the AC
Platform. It is a single Next.js 15 (App Router, RSC) deployment that serves:

- the marketing homepage,
- a programmatic SEO surface across every (service × city × area) and (brand × service) cell,
- the multi-step booking funnel,
- noindex Google Ads landing pages at `/lp/[slug]`,
- a Markdown/MDX blog engine,
- the public `/api/lead` proxy that talks to the NestJS backend.

It is **not** a brochure site. Treat it as a lead-acquisition engine with the
following performance + conversion targets:

| Surface              | LCP target | INP target | Notes                          |
| -------------------- | ---------- | ---------- | ------------------------------ |
| Homepage             | < 2.0s     | < 200ms    | ISR (revalidate 300s)          |
| Service pages        | < 2.0s     | < 200ms    | ISR (revalidate 3600s)         |
| City × service pages | < 2.0s     | < 200ms    | SSG for live cities            |
| Landing pages        | < 1.5s     | < 200ms    | noindex, minimal chrome        |
| Blog posts           | < 2.5s     | < 200ms    | SSG, MDX compiled at build     |

## 1. Architecture

```
apps/web
├── src/
│   ├── app/                       # Next 15 App Router routes
│   │   ├── (home)/                # implicit — page.tsx is the homepage
│   │   ├── [city]/                # programmatic SEO — city root + city × service
│   │   ├── api/lead/              # /api/lead proxy → NestJS public-intake
│   │   ├── areas/[area]/          # /areas/<slug> SEO pages
│   │   ├── blog/                  # MDX blog index + detail
│   │   ├── book/                  # multi-step booking funnel
│   │   ├── brands/                # brand index + /brands/[brand]/[service]
│   │   ├── lp/                    # Google Ads landing pages (noindex)
│   │   ├── services/              # service index + detail
│   │   ├── manifest.ts            # PWA manifest
│   │   ├── opengraph-image.tsx    # default 1200×630 OG image (edge-rendered)
│   │   ├── robots.ts              # /robots.txt
│   │   └── sitemap.ts             # /sitemap.xml
│   ├── components/
│   │   ├── analytics/             # <AnalyticsScripts>, <AnalyticsRouteTracker>
│   │   ├── blog/                  # ReadingProgressBar, TOC parser
│   │   ├── booking/               # <BookingForm> (multi-step)
│   │   ├── home/                  # Hero / ServiceGrid / TrustStrip / …
│   │   ├── layout/                # SiteHeader / SiteFooter / Breadcrumbs / WhatsAppFab
│   │   ├── sections/              # CtaBand / Faq / ServiceDetail (canonical renderer)
│   │   └── seo/                   # <JsonLd>
│   ├── content/                   # Catalogues — services, cities, brands, reviews, FAQs, MDX blog
│   ├── hooks/                     # use-live-stats
│   └── lib/                       # SEO builders, analytics, WhatsApp, rate-limit
```

The browser never talks directly to the backend for **mutations** — every
write goes through a Next route handler. GETs (live stats, public lookups) hit
the backend directly because they are cacheable / CORS-safe.

## 2. Programmatic SEO

The site ships **400+ generated URLs** out of the box:

| Pattern                              | Source of truth                | Count (live cities) |
| ------------------------------------ | ------------------------------ | ------------------- |
| `/services/[slug]`                   | `content/services.ts`          | 8                   |
| `/[city]`                            | `content/cities.ts`            | 3                   |
| `/[city]/[service]`                  | cities × services              | 24                  |
| `/brands/[brand]`                    | `content/brands.ts`            | 16                  |
| `/brands/[brand]/[service]`          | brand.services × services      | ~50                 |
| `/areas/[area]`                      | flattened from cities          | ~35                 |
| `/blog/[slug]`                       | `content/blog/*.mdx`           | dynamic             |

### How metadata is built

Every page calls `buildMetadata({ title, description, path, ... })` from
`lib/seo/metadata.ts`. The helper:

- joins relative `path` to `siteConfig.url` for a fully-qualified canonical,
- sets `og:image` (defaults to the edge-rendered `/opengraph-image`),
- sets `twitter:card = summary_large_image`,
- emits `robots = noindex,nofollow` when `noindex: true` is passed (landing pages).

### Structured data

JSON-LD is rendered via `<JsonLd>` from `components/seo/json-ld.tsx`. We emit:

- `Organization` + `WebSite` on the root layout (site-wide).
- `LocalBusiness` on `/[city]` and `/[city]/[service]` (city-grounded).
- `Service` + `Offer` on every service page (including the brand × service combination).
- `FAQPage` on the homepage, every service page, and every blog post that has FAQs.
- `BreadcrumbList` automatically alongside the visible breadcrumb trail.
- `Review` + `AggregateRating` on `/reviews` and every service page.
- `Article` on blog posts.

If you change `lib/seo/json-ld.ts` you **must** validate the output against
[validator.schema.org](https://validator.schema.org/) and re-test in Google
Search Console's URL Inspector for at least one URL of every type.

### Reserved slugs

`/[city]` is a catch-all that lives at the URL root, so it has to dodge our
static top-level routes (`/about`, `/blog`, `/lp`, …). The reserved list lives
at `content/reserved-slugs.ts` — **add to it whenever you create a new
top-level static route**.

### Landing pages (`/lp/*`)

Landing pages are forced `robots: noindex` because the same content lives on
the canonical `/[city]/[service]` URLs for organic. They are excluded from
`sitemap.ts` for the same reason.

The hero supports `{{keyword}}` substitution via `lib/utils.ts#substituteKeyword`
so an ad with `?kw=ac+repair+kormangala` renders that exact phrase in H1. The
substitution is sanitised (regex strip) so the URL can't inject HTML.

## 3. Content authoring

Three places store content:

1. **Catalogues** (TypeScript) — services, cities, brands, reviews, FAQs,
   featured technicians, landing pages. Use `src/content/*.ts`. Edits go
   through code review and ship on the next deploy.
2. **MDX blog** — drop a `*.mdx` file under `src/content/blog/`. The
   loader (`content/blog.ts`) validates the frontmatter against a Zod
   schema and surfaces validation errors in the dev console.
3. **Server-fetched stats** — `lib/public-api.ts#fetchPublicStats` pulls
   live counters from the backend with ISR.

### MDX blog frontmatter

```yaml
---
title: "Your post title"
description: "≤ 220-char meta description"
publishedAt: "2025-04-12"           # required
updatedAt: "2025-04-22"              # optional
author: "AC Platform Editorial"
cover: "/images/blog/cover.webp"
tags: ["ac", "guide"]
category: "guide"                     # guide | maintenance | comparison | troubleshooting | announcement | tips
related: ["other-post-slug"]         # explicit related links (ranked higher than tag-overlap)
canonical: "https://other.example/x" # optional, when republishing
draft: false
faqs:
  - question: "..."
    answer: "..."
---
```

Blog posts support:

- Auto-generated TOC (`extractToc` parses H2 + H3).
- Auto-linked headings via `rehype-slug` + `rehype-autolink-headings`.
- GitHub-flavoured markdown via `remark-gfm`.
- FAQ JSON-LD when frontmatter `faqs` is set.
- Article JSON-LD always.

## 4. Booking funnel

`/book` is a three-step React-Hook-Form flow:

1. **Service** — appliance category, city, brand, freeform issue text.
2. **Contact** — name + phone (E.164 sanitised), WhatsApp opt-in.
3. **Schedule** — address, pincode, preferred slot.

Fires three GA / Pixel events: `lead_start`, `lead_step_completed`, `lead_submitted`.

UTM / `gclid` / `fbclid` parameters are captured via
`captureAttribution(searchParams)` on mount and persisted in `sessionStorage`
so they survive the redirect from a Google Ads click → landing page → booking
form. On submit, attribution is forwarded as `utm: {...}` to the backend.

## 5. Lead intake API

```
Public website          /api/lead (Next route handler)         NestJS public-intake
─────────────────  ──────────────────────────────────────────  ────────────────────
React form ───────►  rate-limit (5 / min / IP)                  → resolveTenantId()
                  ►  honeypot check (`hp_url`)                  → publicCreate(tenantId, dto)
                  ►  Zod validate                                → LeadsService.publicCreate
                  ►  forward + x-internal-token header          → DomainEventBus.publish
                  ◄  { ok, leadCode, source }                   ← Lead row created
```

- Rate limit: **5 / minute / IP** at the Next edge AND `@nestjs/throttler` on
  the backend (Redis-backed in production).
- Honeypot field `hp_url` is rendered with `display:none` — bots fill it,
  humans don't. The route returns a 202 success body so bots don't realise
  they were caught.
- Server-only `PUBLIC_LEAD_API_TOKEN` is forwarded as `x-internal-token` to
  the backend so the backend can verify the request originated from our
  deployment. (TODO: enable backend-side verification when ops rotates the
  token.)

## 6. Analytics

`<AnalyticsScripts>` (root layout) lazy-loads:

- **GA4** when `NEXT_PUBLIC_GA_ID` is set.
- **GTM** when `NEXT_PUBLIC_GTM_ID` is set.
- **Meta Pixel** when `NEXT_PUBLIC_META_PIXEL_ID` is set.

All `track()` calls from `lib/analytics.ts` fan out to each configured
destination. Standard events live in the `Events` enum; **always add new
events there rather than passing free strings** so reporting stays clean.

Meta Pixel event mapping is centralised in `META_EVENT_MAP`. Mappings:

| Canonical event       | Meta Pixel event   |
| --------------------- | ------------------ |
| `lead_start`          | `InitiateCheckout` |
| `lead_step_completed` | `AddPaymentInfo`   |
| `lead_submitted`      | `Lead`             |
| `booking_confirmed`   | `Purchase`         |
| `whatsapp_click`      | `Contact`          |
| `call_click`          | `Contact`          |

## 7. WhatsApp conversion

`lib/whatsapp.ts` exposes:

- `buildWhatsAppLink({ number?, message })` — strips non-digits, URL-encodes the message.
- `WhatsAppTemplates` — opinionated message templates per context.

Three WhatsApp surfaces ship out of the box:

1. **Floating FAB** — `<WhatsAppFab>` mounted in the root layout.
2. **Contextual buttons** — every service / city / brand page has a "Chat on
   WhatsApp" CTA pre-filled with a context-aware message.
3. **Exit-intent sheet** — `<ExitIntentSheet>` shows once per session on
   desktop when the mouse leaves the top of the viewport.

## 8. Performance posture

- `next/font` with `display: swap` for the Inter family.
- `next/image` with AVIF + WebP, long `minimumCacheTTL`, generous device-sizes.
- `optimizePackageImports: ['lucide-react', '@ac/ui']` in `next.config.mjs`.
- Long-cache `Cache-Control` on `/_next/static/*`.
- Static generation everywhere except `/api/*` and `/book/success`.
- ISR (revalidate 300s on the homepage, 3600s on SEO pages) so live stats
  refresh without rebuilding the world.
- No client-side data fetching on first paint — every page reads stats from
  the cached `fetchPublicStats()` server call.

## 9. Accessibility

- All interactive elements are real `<button>` / `<a>` (no role-faking divs).
- Keyboard focus rings preserved via `focus-visible:ring-2`.
- Sticky-bottom mobile CTAs leave at least 56px of clearance and respect
  `prefers-reduced-motion`.
- The progress bar in the booking funnel exposes `aria-valuenow`.

## 10. Adding a new service / city / brand

### Service

1. Add an entry to `content/services.ts`.
2. Make sure `pricing` has at least one band and `faqs` has at least one Q&A.
3. The route appears at `/services/<slug>` and is included in the sitemap on
   next deploy.

### City

1. Add an entry to `content/cities.ts` with `isLive: true` and a non-empty
   `areas` array.
2. The site auto-generates `/<city>`, `/<city>/<service>` for every service,
   and `/areas/<area>` for every area, on next deploy.

### Brand

1. Add an entry to `content/brands.ts`.
2. Set `services` to the `ServiceCategory[]` you cover for that brand.
3. The site auto-generates `/brands/<slug>` and `/brands/<slug>/<service>`.

## 11. Testing

```
pnpm --filter @ac/web test     # vitest unit suite
pnpm --filter @ac/web test:e2e # playwright smoke (extend per release)
```

Tests cover:

- `buildMetadata` + `uniqKeywords` SEO helpers.
- JSON-LD generators (shape + required fields).
- Content catalogues (service / city / brand / review / LP).
- Blog TOC parser.
- WhatsApp link / template builders.
- Rate limiter (allow + reset).
- `/api/lead` route handler (success / validation / honeypot / rate-limit).

Run them before every deploy to catch regressions in the SEO surface.

## 12. Configuration

| Env var                              | Required | Purpose                                                 |
| ------------------------------------ | -------- | ------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`                | ✔        | Public NestJS API URL                                    |
| `NEXT_PUBLIC_WEB_URL`                | ✔        | This site's canonical URL (used in metadata + sitemap)   |
| `NEXT_PUBLIC_ADMIN_URL`              | ✔        | Admin CRM URL (footer links)                             |
| `NEXT_PUBLIC_TENANT_SLUG`            |          | Tenant slug forwarded as `x-ac-tenant` to the API        |
| `NEXT_PUBLIC_WHATSAPP_NUMBER`        |          | Default WhatsApp number for the FAB / templates          |
| `NEXT_PUBLIC_SUPPORT_PHONE`          |          | Header / footer call number                              |
| `NEXT_PUBLIC_SUPPORT_EMAIL`          |          | Footer + contact page                                    |
| `NEXT_PUBLIC_LEGAL_NAME`             |          | Used in Organisation JSON-LD                             |
| `NEXT_PUBLIC_GA_ID`                  |          | GA4 measurement id                                       |
| `NEXT_PUBLIC_GTM_ID`                 |          | Google Tag Manager id                                    |
| `NEXT_PUBLIC_META_PIXEL_ID`          |          | Meta Pixel id                                            |
| `NEXT_PUBLIC_TWITTER_HANDLE`         |          | `twitter:site` meta                                      |
| `WEB_INTERNAL_API_URL`               |          | Server-only API base (Docker / VPC). Defaults to public. |
| `WEB_TENANT_ID`                      |          | Optional override for tenant resolution                  |
| `PUBLIC_LEAD_API_TOKEN`              |          | Forwarded as `x-internal-token` for API to verify        |

## 13. Roadmap (post-MVP)

- Replace fixture reviews with a `/public/reviews` backend endpoint.
- Hook `/[city]` "live technicians online" to the realtime gateway via
  websocket (currently polled every 30s).
- Add `next/og` per-page OG images for every service / city.
- Wire OTP-on-phone-verify into the booking flow (the `LeadsService.publicCreate`
  call already supports it — we just need the OTP UI on step 2).
- AI-generated city-specific copy + area-specific blog "near me" pages.
