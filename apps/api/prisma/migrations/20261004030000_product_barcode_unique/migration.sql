-- Unique barcode per organization (multiple NULLs allowed in PostgreSQL)
CREATE UNIQUE INDEX IF NOT EXISTS "Product_organizationId_barcode_key" ON "Product"("organizationId", "barcode");
