import Link from "next/link";
import { FinansTabs } from "@/components/admin/finans-tabs";

export const dynamic = "force-dynamic";

export default function FinansLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">Finans</h1>
          <p className="text-sm text-muted-foreground">Gelir, gider, tedarikçi cari hesapları</p>
        </div>
        <Link href="/yonetim" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          Özete dön
        </Link>
      </div>
      <FinansTabs />
      {children}
    </div>
  );
}
