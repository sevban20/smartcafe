import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/guards";

export const dynamic = "force-dynamic";

/**
 * Bekleyen (PENDING) siparislerin hafif listesi. Bildirim icin yoklanir;
 * KDS'de hangi sekme acik olursa olsun yeni siparis kacmaz.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const orders = await prisma.order.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
    select: { id: true, orderNo: true, tableNo: true, source: true, createdAt: true },
    take: 100,
  });
  return NextResponse.json({ orders }, { headers: { "Cache-Control": "no-store" } });
}
