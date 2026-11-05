"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guards";
import { dataUrlToUpload, isAcceptableMediaRef } from "@/lib/uploads";
import { normalizeHex } from "@/lib/site-settings";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const optText = (max: number) => z.string().trim().max(max).optional().nullable();
const optMedia = z
  .string()
  .trim()
  .refine((v) => isAcceptableMediaRef(v) && !v.startsWith("data:"), "Geçersiz dosya adresi")
  .optional()
  .nullable();
const optLink = z
  .string()
  .trim()
  .refine((v) => v === "" || /^https:\/\//.test(v), "Bağlantılar https:// ile başlamalı")
  .optional()
  .nullable();

const settingsSchema = z.object({
  brandName: z.string().trim().min(1, "Marka adı gerekli").max(60),
  tagline: optText(80),
  logoUrl: optMedia,
  brandColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Renk #RRGGBB biçiminde olmalı"),
  heroVideoUrl: optMedia,
  heroImageUrl: optMedia,
  welcomeText: optText(160),
  instagramUrl: optLink,
  googleReviewUrl: optLink,
  wifiName: optText(60),
  wifiPassword: optText(60),
  phone: optText(30),
  address: optText(160),
});

export async function saveSiteSettings(input: unknown): Promise<Result> {
  await requireUser(["ADMIN"]);
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  const clean = (x: string | null | undefined) => (x && x.trim() ? x.trim() : null);

  const data = {
    brandName: v.brandName,
    tagline: clean(v.tagline),
    logoUrl: clean(v.logoUrl),
    brandColor: normalizeHex(v.brandColor),
    heroVideoUrl: clean(v.heroVideoUrl),
    heroImageUrl: clean(v.heroImageUrl),
    welcomeText: clean(v.welcomeText),
    instagramUrl: clean(v.instagramUrl),
    googleReviewUrl: clean(v.googleReviewUrl),
    wifiName: clean(v.wifiName),
    wifiPassword: clean(v.wifiPassword),
    phone: clean(v.phone),
    address: clean(v.address),
  };

  await prisma.siteSetting.upsert({ where: { id: "default" }, create: { id: "default", ...data }, update: data });
  revalidatePath("/menu", "layout");
  revalidatePath("/yonetim/menu/gorunum");
  return { ok: true };
}

/**
 * Eski yontemle veritabanina gomulu (data:image/...) urun gorsellerini dosyaya
 * tasir. Gorsel bozuksa dokunmaz. Tekrar calistirmak guvenlidir.
 */
export async function migrateInlineImages(): Promise<Result<{ moved: number; failed: number }>> {
  await requireUser(["ADMIN"]);
  const products = await prisma.product.findMany({
    where: { imageUrl: { startsWith: "data:" } },
    select: { id: true, imageUrl: true },
  });

  let moved = 0;
  let failed = 0;
  for (const p of products as { id: string; imageUrl: string | null }[]) {
    try {
      const url = p.imageUrl ? await dataUrlToUpload(p.imageUrl) : null;
      if (!url) {
        failed++;
        continue;
      }
      await prisma.product.update({ where: { id: p.id }, data: { imageUrl: url } });
      moved++;
    } catch {
      failed++;
    }
  }

  revalidatePath("/menu", "layout");
  revalidatePath("/yonetim/menu");
  revalidatePath("/yonetim/menu/gorunum");
  return { ok: true, moved, failed };
}
