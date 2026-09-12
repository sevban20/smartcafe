import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Musteriye gosterilecek pencere: son 12 saat (gece yarisini asan vardiyalari da kapsar) */
const CUSTOMER_WINDOW_HOURS = 12;

/**
 * Bir masanin ACIK hesabini dondurur (musteri "Siparişlerim" ekrani icin).
 * Giris gerektirmez ama yalnizca:
 *  - o masaya ait,
 *  - iptal edilmemis,
 *  - HENUZ ODENMEMIS (paidAt = null),
 *  - son 12 saat icindeki
 * kayitlari gosterir. Hesap kapatilinca liste otomatik bosalir, yani
 * masaya oturan bir sonraki musteri onceki hesabi gormez.
 */
export async function GET(req: Request, { params }: { params: { tableNo: string } }) {
  // Giris gerektirmeyen bir uc; kazima ve kotuye kullanimi sinirla
  if (!rateLimit(`masa:${clientIp(req)}`, 120, 5 * 60_000).ok) {
    return NextResponse.json({ error: "Çok fazla istek." }, { status: 429 });
  }

  const tableNo = decodeURIComponent(params.tableNo).trim();
  const since = new Date(Date.now() - CUSTOMER_WINDOW_HOURS * 60 * 60 * 1000);

  const orders = await prisma.order.findMany({
    where: {
      tableNo,
      status: { not: "CANCELLED" },
      paidAt: null,
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    include: { orderItems: { where: { cancelledAt: null }, include: { selectedOptions: true } } },
    take: 30,
  });

  const total = orders.reduce((sum: number, o: { totalAmount: number }) => sum + o.totalAmount, 0);

  return NextResponse.json({ orders, total });
}
