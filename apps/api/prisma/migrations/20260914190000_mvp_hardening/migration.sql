-- Existing events have no external identifier; new deliveries are deduplicated.
ALTER TABLE "WebhookEvent" ADD COLUMN "externalEventId" TEXT;
CREATE UNIQUE INDEX "WebhookEvent_externalEventId_key" ON "WebhookEvent"("externalEventId");
-- Personal choices must not be reused across users. Keep transaction edits intact.
DELETE FROM "MerchantCategoryCache" WHERE "source" = 'MANUAL';
UPDATE "MerchantCategoryCache" SET "sampleDescription" = NULL;
