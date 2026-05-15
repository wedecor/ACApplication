# AC Platform - Customer Mobile App

Expo / React Native client used by customers to book appliance repairs, track
technicians live, manage AMC memberships and pay invoices on the go.

## Quickstart

```bash
pnpm -F @ac/customer-app dev      # Expo dev server
pnpm -F @ac/customer-app android  # native run on Android
pnpm -F @ac/customer-app ios      # native run on iOS
pnpm -F @ac/customer-app test     # jest unit tests
pnpm -F @ac/customer-app lint
pnpm -F @ac/customer-app typecheck
```

Runtime configuration is read from `app.json -> expo.extra`. Override per
environment via EAS profiles or `app.config.js`.

| Key                | Purpose                                              |
| ------------------ | ---------------------------------------------------- |
| `apiUrl`           | NestJS API base URL                                  |
| `wsUrl`            | Realtime websocket URL (same origin as `apiUrl`)     |
| `whatsappNumber`   | Number used by all `wa.me` deep-links                |
| `supportPhone`     | Number used by `tel:` deep-links                     |
| `supportEmail`     | Used by `mailto:` deep-links                         |

See the architecture and feature details in [`docs/customer-app.md`](../../docs/customer-app.md).
