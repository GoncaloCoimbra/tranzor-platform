CREATE TABLE "ProcessedStockSyncEvent" (
    "eventId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedStockSyncEvent_pkey" PRIMARY KEY ("eventId")
);

CREATE INDEX "ProcessedStockSyncEvent_companyId_processedAt_idx"
ON "ProcessedStockSyncEvent"("companyId", "processedAt");

CREATE TABLE "StockSyncDeadLetter" (
    "id" TEXT NOT NULL,
    "eventId" TEXT,
    "companyId" TEXT,
    "channel" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "error" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockSyncDeadLetter_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StockSyncDeadLetter_eventId_idx"
ON "StockSyncDeadLetter"("eventId");

CREATE INDEX "StockSyncDeadLetter_companyId_createdAt_idx"
ON "StockSyncDeadLetter"("companyId", "createdAt");
