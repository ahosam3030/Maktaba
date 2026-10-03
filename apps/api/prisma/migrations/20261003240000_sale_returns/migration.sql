-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN IF NOT EXISTS "returnedQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE IF NOT EXISTS "SaleReturn" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "returnNumber" TEXT,
    "returnDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total" DECIMAL(12,3) NOT NULL,
    "refundAmount" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SaleReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SaleReturnItem" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "saleItemId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitPrice" DECIMAL(12,3) NOT NULL,
    "unitCost" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(12,3) NOT NULL,
    CONSTRAINT "SaleReturnItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SaleReturn_organizationId_returnDate_idx" ON "SaleReturn"("organizationId", "returnDate");
CREATE INDEX IF NOT EXISTS "SaleReturn_saleId_idx" ON "SaleReturn"("saleId");
CREATE INDEX IF NOT EXISTS "SaleReturnItem_returnId_idx" ON "SaleReturnItem"("returnId");
CREATE INDEX IF NOT EXISTS "SaleReturnItem_saleItemId_idx" ON "SaleReturnItem"("saleItemId");

DO $$ BEGIN
  ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_saleId_fkey"
    FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SaleReturnItem" ADD CONSTRAINT "SaleReturnItem_returnId_fkey"
    FOREIGN KEY ("returnId") REFERENCES "SaleReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SaleReturnItem" ADD CONSTRAINT "SaleReturnItem_saleItemId_fkey"
    FOREIGN KEY ("saleItemId") REFERENCES "SaleItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
