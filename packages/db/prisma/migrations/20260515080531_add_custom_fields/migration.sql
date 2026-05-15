-- CreateEnum
CREATE TYPE "CustomFieldEntity" AS ENUM ('LEAD', 'DEAL');

-- CreateEnum
CREATE TYPE "CustomFieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'SELECT', 'MULTI_SELECT', 'CHECKBOX', 'URL');

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "customData" JSONB;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "customData" JSONB;

-- CreateTable
CREATE TABLE "CustomFieldDef" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "entity" "CustomFieldEntity" NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "CustomFieldType" NOT NULL,
    "options" JSONB,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomFieldDef_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomFieldDef_organizationId_entity_order_idx" ON "CustomFieldDef"("organizationId", "entity", "order");

-- CreateIndex
CREATE UNIQUE INDEX "CustomFieldDef_organizationId_entity_slug_key" ON "CustomFieldDef"("organizationId", "entity", "slug");

-- AddForeignKey
ALTER TABLE "CustomFieldDef" ADD CONSTRAINT "CustomFieldDef_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
