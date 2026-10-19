-- Custom roles: role keys are no longer limited to the UserRole enum.
-- System roles keep their enum value as text; tenant roles use CUSTOM_<NAME>.
ALTER TABLE "roles" ALTER COLUMN "key" TYPE TEXT USING "key"::text;

ALTER TABLE "roles"
  ADD COLUMN "isCustom" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "createdBy" TEXT,
  ADD COLUMN "updatedBy" TEXT;
