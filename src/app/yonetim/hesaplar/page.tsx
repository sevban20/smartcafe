import { OpenTables } from "@/components/kds/open-tables";
import { TableTransfers } from "@/components/admin/table-transfers";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Açık Hesaplar" };

/** Yonetici surumu: yonetim panelinin icinde, alt gezinme korunur. */
export default function YonetimHesaplarPage() {
  return (
    <div className="space-y-6">
      <OpenTables embedded />
      <TableTransfers />
    </div>
  );
}
