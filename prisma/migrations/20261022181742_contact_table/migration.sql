/*
  Warnings:

  - You are about to drop the `contactSubmissions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "contactSubmissions";

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "inquiryType" VARCHAR(30) NOT NULL,
    "organization" VARCHAR(120),
    "subject" VARCHAR(150) NOT NULL,
    "message" VARCHAR(2000) NOT NULL,
    "status" "ContactStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contacts_status_createdAt_idx" ON "contacts"("status", "createdAt");

-- CreateIndex
CREATE INDEX "contacts_email_idx" ON "contacts"("email");

-- CreateIndex
CREATE INDEX "contacts_inquiryType_idx" ON "contacts"("inquiryType");
