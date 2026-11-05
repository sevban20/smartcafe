import { MenuClient } from "@/components/menu/menu-client";
import { getMenuCategories } from "@/lib/menu-data";
import { brandCss, getSiteSettings } from "@/lib/site-settings";
import type { Metadata, Viewport } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  return { title: { absolute: `${settings.brandName} · Menü` } };
}

export async function generateViewport(): Promise<Viewport> {
  const settings = await getSiteSettings();
  return { themeColor: settings.brandColor };
}

export default async function MenuPage({ params }: { params: { tableNo: string } }) {
  const tableNo = decodeURIComponent(params.tableNo);
  const [categories, settings] = await Promise.all([getMenuCategories(), getSiteSettings()]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: brandCss(settings.brandColor) }} />
      <MenuClient tableNo={tableNo} categories={categories} settings={settings} />
    </>
  );
}
