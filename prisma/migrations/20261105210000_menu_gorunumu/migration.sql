-- Menu gorunumu: kategori gorseli/aciklamasi, alt kategoriler, menu ayarlari
-- Yalnizca ekleme yapar; tekrar calistirilabilir.

-- AlterTable: kategori alanlari (hepsi bos baslar, mevcut kategoriler ust kategori olarak kalir)
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "parentId" TEXT;

CREATE INDEX IF NOT EXISTS "Category_parentId_idx" ON "Category"("parentId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Category_parentId_fkey') THEN
    ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey"
      FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

-- CreateTable: menu ayarlari (tek satir)
CREATE TABLE IF NOT EXISTS "SiteSetting" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "brandName" TEXT NOT NULL DEFAULT 'Çamlı Kahve',
    "tagline" TEXT,
    "logoUrl" TEXT,
    "brandColor" TEXT NOT NULL DEFAULT '#8B5E3C',
    "heroVideoUrl" TEXT,
    "heroImageUrl" TEXT,
    "welcomeText" TEXT,
    "instagramUrl" TEXT,
    "googleReviewUrl" TEXT,
    "wifiName" TEXT,
    "wifiPassword" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("id")
);
