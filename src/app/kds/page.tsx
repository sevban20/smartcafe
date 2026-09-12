import { requireUser } from "@/lib/guards";
import { KdsBoard } from "@/components/kds/kds-board";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sipariş Ekranı" };

export default async function KdsPage({ searchParams }: { searchParams: { hata?: string } }) {
  const user = await requireUser(["ADMIN", "STAFF"]);
  return <KdsBoard userName={user.name ?? undefined} accessDenied={searchParams.hata === "yetki"} />;
}
