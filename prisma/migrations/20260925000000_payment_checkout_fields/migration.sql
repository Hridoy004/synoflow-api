-- AlterEnum
ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'BKASH';

-- AlterTable
ALTER TABLE "Payment"
ADD COLUMN "subscriptionId" TEXT,
ADD COLUMN "providerSessionId" TEXT,
ADD COLUMN "providerTransactionId" TEXT,
ADD COLUMN "paidAt" TIMESTAMP(3),
ALTER COLUMN "currency" SET DEFAULT 'BDT';

-- CreateIndex
CREATE INDEX "Payment_subscriptionId_idx"
ON "Payment"("subscriptionId");

-- AddForeignKey
ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_subscriptionId_fkey"
FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
