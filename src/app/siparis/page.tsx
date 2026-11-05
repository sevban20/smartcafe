import { requireUser } from "@/lib/guards";
import { MenuClient } from "@/components/menu/menu-client";
import { getMenuCategories } from "@/lib/menu-data";
import { brandCss, getSiteSettings } from "@/lib/site-settings";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sipariş Al" };

/** Garsonun kendi telefonundan masa adina siparis girdigi ekran. */
export default async function SiparisAlPage({ searchParams }: { searchParams: { masa?: string } }) {
  const user = await requireUser(["ADMIN", "STAFF"]);
  const [categories, settings] = await Promise.all([getMenuCategories(), getSiteSettings()]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: brandCss(settings.brandColor) }} />
      <MenuClient
        tableNo={searchParams.masa?.trim() ?? ""}
        categories={categories}
        settings={settings}
        staffMode
        staffName={user.name ?? undefined}
      />
    </>
  );
}
