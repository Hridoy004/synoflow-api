-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'RESOLVED', 'SPAM');

-- CreateTable
CREATE TABLE "contactSubmissions" (
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

    CONSTRAINT "contactSubmissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contactSubmissions_status_createdAt_idx" ON "contactSubmissions"("status", "createdAt");

-- CreateIndex
CREATE INDEX "contactSubmissions_email_idx" ON "contactSubmissions"("email");

-- CreateIndex
CREATE INDEX "contactSubmissions_inquiryType_idx" ON "contactSubmissions"("inquiryType");
