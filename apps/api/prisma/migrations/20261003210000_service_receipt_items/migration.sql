CREATE TABLE IF NOT EXISTS "ServiceReceiptItem" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "serviceId" TEXT,
    "serviceName" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(12,3) NOT NULL DEFAULT 0,
    CONSTRAINT "ServiceReceiptItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ServiceReceiptItem_receiptId_idx" ON "ServiceReceiptItem"("receiptId");
DO $$ BEGIN
  ALTER TABLE "ServiceReceiptItem" ADD CONSTRAINT "ServiceReceiptItem_receiptId_fkey"
    FOREIGN KEY ("receiptId") REFERENCES "ServiceReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
