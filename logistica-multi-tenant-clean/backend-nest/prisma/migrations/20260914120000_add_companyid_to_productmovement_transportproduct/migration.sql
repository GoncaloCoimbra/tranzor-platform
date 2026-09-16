-- Add companyId columns to existing tables first, so we can backfill data before enforcing NOT NULL.
ALTER TABLE "ProductMovement"
    ADD COLUMN "companyId" TEXT;

ALTER TABLE "TransportProduct"
    ADD COLUMN "companyId" TEXT;

-- Backfill ProductMovement.companyId from the parent Product company.
UPDATE "ProductMovement" pm
SET "companyId" = p."companyId"
FROM "Product" p
WHERE pm."productId" = p."id"
  AND pm."companyId" IS NULL;

-- Backfill TransportProduct.companyId from the parent Transport company.
UPDATE "TransportProduct" tp
SET "companyId" = t."companyId"
FROM "Transport" t
WHERE tp."transportId" = t."id"
  AND tp."companyId" IS NULL;

-- Enforce required company ownership after backfill.
ALTER TABLE "ProductMovement"
    ALTER COLUMN "companyId" SET NOT NULL;

ALTER TABLE "TransportProduct"
    ALTER COLUMN "companyId" SET NOT NULL;

-- Add indexes for tenant scoping and reporting.
CREATE INDEX "ProductMovement_companyId_idx"
    ON "ProductMovement"("companyId");

CREATE INDEX "TransportProduct_companyId_idx"
    ON "TransportProduct"("companyId");

-- Add foreign keys to Company.
ALTER TABLE "ProductMovement"
    ADD CONSTRAINT "ProductMovement_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TransportProduct"
    ADD CONSTRAINT "TransportProduct_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
