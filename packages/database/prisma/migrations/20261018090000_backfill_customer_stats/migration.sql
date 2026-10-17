-- Backfill denormalised customer stats that were never maintained.
-- Mirrors CustomerStatsService: non-draft bookings; paid minus refunded on
-- non-cancelled invoices. Ongoing updates come from the stats listener.
UPDATE "customers" c
SET
  "totalBookings" = (
    SELECT COUNT(*)::int FROM "bookings" b
    WHERE b."customerId" = c."id" AND b."deletedAt" IS NULL AND b."status" <> 'DRAFT'
  ),
  "lifetimeValueMinor" = GREATEST(0, COALESCE((
    SELECT SUM(i."amountPaidMinor" - i."amountRefundedMinor") FROM "invoices" i
    WHERE i."customerId" = c."id" AND i."deletedAt" IS NULL AND i."status" <> 'CANCELLED'
  ), 0));
