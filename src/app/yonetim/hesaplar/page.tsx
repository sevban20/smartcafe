import { OpenTables } from "@/components/kds/open-tables";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Açık Hesaplar" };

/** Yonetici surumu: yonetim panelinin icinde, alt gezinme korunur. */
export default function YonetimHesaplarPage() {
  return <OpenTables embedded />;
}
