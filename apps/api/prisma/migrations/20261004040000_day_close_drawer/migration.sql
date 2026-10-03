CREATE TABLE "DayClose" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "openingFloat" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "cashSales" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "cashIn" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "cashOut" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "expectedCash" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "countedCash" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "variance" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "closedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DayClose_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DayClose_organizationId_businessDate_key" ON "DayClose"("organizationId", "businessDate");
CREATE INDEX "DayClose_organizationId_businessDate_idx" ON "DayClose"("organizationId", "businessDate");

CREATE TABLE "DrawerEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "reason" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DrawerEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DrawerEvent_organizationId_createdAt_idx" ON "DrawerEvent"("organizationId", "createdAt");
CREATE INDEX "DrawerEvent_organizationId_kind_idx" ON "DrawerEvent"("organizationId", "kind");
