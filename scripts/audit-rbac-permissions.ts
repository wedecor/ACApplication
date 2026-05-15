#!/usr/bin/env tsx
/**
 * CI guard — registry must match database permissions and role mappings.
 */
import { PrismaClient } from '@prisma/client';
import { assertRegistryValid, validateRegistry } from '@ac/auth';
import { auditRbacConsistency } from '@ac/database';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const registry = validateRegistry();
  if (!registry.valid) {
    console.error('RBAC registry validation failed:', registry);
    process.exit(1);
  }
  assertRegistryValid();

  const report = await auditRbacConsistency(prisma);
  if (!report.inSync) {
    console.error('RBAC permission audit failed:');
    if (report.missingInDb.length) {
      console.error(`  missing in DB (${report.missingInDb.length}):`, report.missingInDb.slice(0, 20));
    }
    if (report.orphanInDb.length) {
      console.error(`  orphan in DB (${report.orphanInDb.length}):`, report.orphanInDb.slice(0, 20));
    }
    if (report.duplicateInDb.length) {
      console.error(`  duplicate keys:`, report.duplicateInDb);
    }
    if (report.staleRoles.length) {
      console.error(`  stale role mappings:`, report.staleRoles.slice(0, 10));
    }
    console.error('\nRun: pnpm db:seed');
    process.exit(1);
  }

  console.log(
    `RBAC permission audit passed (${report.registryPermissionCount} registry / ${report.dbPermissionCount} db permissions).`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
