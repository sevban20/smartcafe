import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";
import { SiteSettingsForm } from "@/components/admin/site-settings-form";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Menü Görünümü" };

export default async function MenuGorunumPage() {
  const [settings, inlineCount] = await Promise.all([
    getSiteSettings(),
    prisma.product.count({ where: { imageUrl: { startsWith: "data:" } } }),
  ]);
  return <SiteSettingsForm initial={settings} inlineImageCount={inlineCount} />;
}
