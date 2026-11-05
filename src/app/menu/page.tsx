import { TableEntry } from "@/components/menu/table-entry";
import { brandCss, getSiteSettings } from "@/lib/site-settings";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  return { title: { absolute: `${settings.brandName} · Menü` } };
}

export default async function MenuGirisPage() {
  const settings = await getSiteSettings();
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: brandCss(settings.brandColor) }} />
      <TableEntry settings={settings} />
    </>
  );
}
