-- AlterTable
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "minStock" DECIMAL(12,3) NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Product_organizationId_active_idx" ON "Product"("organizationId", "active");
