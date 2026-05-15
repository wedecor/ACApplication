# @ac/database

Prisma schema, generated client, migrations and seed data for AC Platform.

## Conventions

- **IDs**: CUID strings.
- **Timestamps**: every model has `createdAt`, `updatedAt`, and `deletedAt` (soft delete).
- **Audit**: high-value models additionally track `createdBy`, `updatedBy`, `deletedBy` and emit rows to `audit_logs`.
- **Money**: stored in integer minor units (paise). Never `Decimal`/`Float`.
- **Tenancy**: every user-scoped table carries `tenantId`.
- **Geography**: every operational entity references a `City`.

## Commands

```bash
pnpm --filter @ac/database generate         # Generate Prisma client
pnpm --filter @ac/database migrate:dev      # Create + apply a new migration
pnpm --filter @ac/database migrate:deploy   # Apply pending migrations (CI/prod)
pnpm --filter @ac/database studio           # Open Prisma Studio
pnpm --filter @ac/database seed             # Idempotent seed
pnpm --filter @ac/database reset            # Drop + migrate + seed
```

## Usage

```ts
import { prisma } from '@ac/database';

const user = await prisma.user.findUnique({ where: { id } });
```

The exported client is automatically wrapped with:

- soft-delete filtering on reads + rewrites on writes,
- audit logging into `audit_logs`.
