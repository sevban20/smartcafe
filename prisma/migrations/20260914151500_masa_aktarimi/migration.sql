-- Masa aktarimi: acik adisyonu baska masaya tasima ozelligi
-- Tekrar calistirilabilir olsun diye IF NOT EXISTS / DO blogu kullanildi;
-- elle yarim uygulanmis bir veritabaninda da guvenle calisir.

-- AlterTable: siparisin hangi masadan tasindiginin izi
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "movedFromTable" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "movedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "movedById" TEXT;

-- CreateTable: aktarim denetim izi
CREATE TABLE IF NOT EXISTS "TableTransfer" (
    "id" TEXT NOT NULL,
    "fromTable" TEXT NOT NULL,
    "toTable" TEXT NOT NULL,
    "orderCount" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "merged" BOOLEAN NOT NULL DEFAULT false,
    "partial" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TableTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TableTransfer_createdAt_idx" ON "TableTransfer"("createdAt");

-- AddForeignKey: aktarimi yapan personel (silinirse alan bosalir)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Order_movedById_fkey') THEN
    ALTER TABLE "Order" ADD CONSTRAINT "Order_movedById_fkey"
      FOREIGN KEY ("movedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TableTransfer_userId_fkey') THEN
    ALTER TABLE "TableTransfer" ADD CONSTRAINT "TableTransfer_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
