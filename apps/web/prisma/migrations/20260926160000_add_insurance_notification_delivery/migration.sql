ALTER TABLE "insurance_arbitration_notification"
  ADD COLUMN "deliveryPreparedAt" TIMESTAMP(3),
  ADD COLUMN "nextPreparationAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "insurance_arbitration_notification_deliveryPreparedAt_nextPreparationAt_idx"
  ON "insurance_arbitration_notification"("deliveryPreparedAt", "nextPreparationAt");

CREATE TABLE "insurance_notification_delivery" (
  "id" TEXT NOT NULL,
  "notificationId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "recipientEmail" TEXT NOT NULL,
  "status" "ReminderDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "failureCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "insurance_notification_delivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "insurance_notification_delivery_notificationId_recipientId_key"
  ON "insurance_notification_delivery"("notificationId", "recipientId");
CREATE INDEX "insurance_notification_delivery_status_nextAttemptAt_idx"
  ON "insurance_notification_delivery"("status", "nextAttemptAt");
CREATE INDEX "insurance_notification_delivery_status_startedAt_idx"
  ON "insurance_notification_delivery"("status", "startedAt");

ALTER TABLE "insurance_notification_delivery"
  ADD CONSTRAINT "insurance_notification_delivery_notificationId_fkey"
  FOREIGN KEY ("notificationId") REFERENCES "insurance_arbitration_notification"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "insurance_notification_delivery"
  ADD CONSTRAINT "insurance_notification_delivery_recipientId_fkey"
  FOREIGN KEY ("recipientId") REFERENCES "user"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
