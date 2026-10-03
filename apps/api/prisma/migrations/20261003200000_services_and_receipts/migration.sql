-- CreateTable
CREATE TABLE IF NOT EXISTS "Service" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unitPrice" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "chargeUnit" TEXT NOT NULL DEFAULT 'job',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ServiceReceipt" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serviceId" TEXT,
    "receiptNo" TEXT NOT NULL,
    "receiptDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customerName" TEXT,
    "serviceName" TEXT NOT NULL,
    "description" TEXT,
    "paperSize" TEXT,
    "colorMode" TEXT,
    "pages" INTEGER NOT NULL DEFAULT 1,
    "copies" INTEGER NOT NULL DEFAULT 1,
    "sides" TEXT,
    "unitPrice" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "extraFees" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "discount" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "cashTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ServiceReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Service_organizationId_name_key" ON "Service"("organizationId", "name");
CREATE INDEX IF NOT EXISTS "Service_organizationId_active_idx" ON "Service"("organizationId", "active");
CREATE UNIQUE INDEX IF NOT EXISTS "ServiceReceipt_organizationId_receiptNo_key" ON "ServiceReceipt"("organizationId", "receiptNo");
CREATE INDEX IF NOT EXISTS "ServiceReceipt_organizationId_receiptDate_idx" ON "ServiceReceipt"("organizationId", "receiptDate");
CREATE INDEX IF NOT EXISTS "ServiceReceipt_organizationId_serviceId_idx" ON "ServiceReceipt"("organizationId", "serviceId");

DO $$ BEGIN
  ALTER TABLE "Service" ADD CONSTRAINT "Service_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ServiceReceipt" ADD CONSTRAINT "ServiceReceipt_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ServiceReceipt" ADD CONSTRAINT "ServiceReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ServiceReceipt" ADD CONSTRAINT "ServiceReceipt_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
