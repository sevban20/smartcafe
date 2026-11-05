-- Cari (veresiye) musteri hesaplari
-- Onceki migration gibi tekrar calistirilabilir yazildi (IF NOT EXISTS / DO bloklari).

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CustomerEntryType') THEN
    CREATE TYPE "CustomerEntryType" AS ENUM ('TAHSILAT', 'BORC');
  END IF;
END
$$;

-- CreateTable: musteri karti
CREATE TABLE IF NOT EXISTS "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "notes" TEXT,
    "creditLimit" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable: tahsilat / elle borc hareketleri
CREATE TABLE IF NOT EXISTS "CustomerEntry" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" "CustomerEntryType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" TEXT,
    "note" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerEntry_pkey" PRIMARY KEY ("id")
);

-- AlterTable: siparisin yazildigi cari musteri
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customerId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_customerId_idx" ON "Order"("customerId");
CREATE INDEX IF NOT EXISTS "CustomerEntry_customerId_date_idx" ON "CustomerEntry"("customerId", "date");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Order_customerId_fkey') THEN
    ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CustomerEntry_customerId_fkey') THEN
    ALTER TABLE "CustomerEntry" ADD CONSTRAINT "CustomerEntry_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CustomerEntry_userId_fkey') THEN
    ALTER TABLE "CustomerEntry" ADD CONSTRAINT "CustomerEntry_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
