-- DropIndex
DROP INDEX IF EXISTS "notification_templates_key_key";

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_key_channel_locale_key" ON "notification_templates"("key", "channel", "locale");
