-- Allow service lines without inventory product
ALTER TABLE "SaleItem" ALTER COLUMN "productId" DROP NOT NULL;
ALTER TABLE "SaleItem" ADD COLUMN IF NOT EXISTS "unit" TEXT;
ALTER TABLE "SaleItem" ALTER COLUMN "unitCost" SET DEFAULT 0;
