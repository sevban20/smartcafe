import { redirect } from "next/navigation";
import { requireUser } from "@/lib/guards";
import { OpenTables } from "@/components/kds/open-tables";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Açık Hesaplar" };

/** Personel surumu: tam ekran, sipariş ekranına dönüş oklu. */
export default async function HesaplarPage() {
  const user = await requireUser(["ADMIN", "STAFF"]);
  // Yonetici panelden geldiginde panel icinde kalsin
  if (user.role === "ADMIN") redirect("/yonetim/hesaplar");
  return <OpenTables />;
}
