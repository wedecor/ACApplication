# Setup

End-to-end instructions for getting AC Platform running on a fresh machine.

## Prerequisites

| Tool                | Version |
| ------------------- | ------- |
| Node.js             | ≥ 20.11 |
| pnpm                | ≥ 9.0   |
| Docker + Compose    | latest  |
| Git                 | ≥ 2.40  |

```bash
# Install Node via nvm
nvm install
nvm use

# Enable pnpm via corepack
corepack enable
corepack prepare pnpm@9.12.0 --activate
```

## 1) Clone & install

```bash
git clone <repo-url> ac-platform
cd ac-platform
pnpm install
```

## 2) Start local infra

```bash
docker compose up -d
# Postgres on 5432, Redis on 6379, MailHog on 8025, MinIO on 9001
```

## 3) Configure environment

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/admin-crm/.env.example apps/admin-crm/.env
cp packages/database/.env.example packages/database/.env
```

Generate secrets (32+ chars):

```bash
openssl rand -base64 48
```

Paste into `JWT_SECRET` and `JWT_REFRESH_SECRET` in `apps/api/.env`.

## 4) Database

```bash
pnpm db:generate     # generate Prisma client
pnpm db:migrate      # apply initial schema
pnpm db:seed         # roles, permissions, sample cities
```

Open Prisma Studio:

```bash
pnpm db:studio
```

## 5) Run

```bash
pnpm dev
```

| Service     | URL                                |
| ----------- | ---------------------------------- |
| Web         | http://localhost:3000              |
| Admin CRM   | http://localhost:3001              |
| API         | http://localhost:4000/api/v1       |
| API docs    | http://localhost:4000/docs         |

## 6) Mobile (optional)

```bash
pnpm --filter @ac/technician-app dev
pnpm --filter @ac/customer-app   dev
```

Install Expo Go on your device or use a simulator. The Metro bundler will print a QR code.

## 7) Tests

```bash
pnpm test           # all unit tests
pnpm test:e2e       # Playwright e2e (build first)
pnpm typecheck      # full type check
pnpm lint           # ESLint
```

## Troubleshooting

- **`pnpm install` fails with `ENOENT prisma`** — Run `pnpm db:generate` afterwards. Some packages need the generated client to typecheck.
- **`Cannot find module '@ac/...'`** — You forgot to add the dep to that workspace's `package.json` or to `pnpm install`.
- **Postgres connection refused** — `docker compose ps`; ensure `ac-postgres` is healthy.
- **Port already in use** — Override via `PORT=4001 pnpm --filter @ac/api dev`.
- **Prisma migrate stalls** — Check `DIRECT_URL`; migration commands need a non-pooled connection.
