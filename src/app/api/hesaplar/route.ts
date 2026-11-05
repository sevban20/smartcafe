import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/guards";
import { PAYMENT_METHODS } from "@/lib/constants";
import { CARI_METHOD, getCustomerBalance } from "@/lib/cari";
import type { OrderStatus, Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type OpenOrder = {
  id: string;
  orderNo: number;
  tableNo: string;
  status: OrderStatus;
  totalAmount: number;
  createdAt: Date;
  movedFromTable: string | null;
  orderItems: { id: string; productName: string; quantity: number; totalPrice: number }[];
};

/** Acik (odenmemis) masa hesaplarini masaya gore gruplayarak dondurur. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const orders: OpenOrder[] = await prisma.order.findMany({
    where: { paidAt: null, status: { not: "CANCELLED" } },
    orderBy: { createdAt: "asc" },
    include: {
      orderItems: {
        where: { cancelledAt: null },
        select: { id: true, productName: true, quantity: true, totalPrice: true },
      },
    },
    take: 200,
  });

  const byTable = new Map<
    string,
    {
      tableNo: string;
      total: number;
      orderCount: number;
      openedAt: string;
      hasUnfinished: boolean;
      orders: OpenOrder[];
    }
  >();

  for (const order of orders) {
    const current = byTable.get(order.tableNo) ?? {
      tableNo: order.tableNo,
      total: 0,
      orderCount: 0,
      openedAt: order.createdAt.toISOString(),
      hasUnfinished: false,
      orders: [],
    };
    current.total += order.totalAmount;
    current.orderCount += 1;
    current.hasUnfinished ||= order.status === "PENDING" || order.status === "PREPARING";
    current.orders.push(order);
    byTable.set(order.tableNo, current);
  }

  const tables = Array.from(byTable.values()).sort((a, b) =>
    a.tableNo.localeCompare(b.tableNo, "tr", { numeric: true })
  );

  return NextResponse.json({
    tables,
    grandTotal: tables.reduce((sum, t) => sum + t.total, 0),
  });
}

const closeSchema = z
  .object({
    tableNo: z.string().min(1),
    paymentMethod: z.union([z.enum(PAYMENT_METHODS), z.literal(CARI_METHOD)]),
    /** Yalnizca paymentMethod "Cari" iken: borcun yazilacagi musteri */
    customerId: z.string().min(1).optional(),
  })
  .refine((v) => v.paymentMethod !== CARI_METHOD || !!v.customerId, {
    message: "Cariye yazmak için müşteri seçin.",
  });

/**
 * Bir masanin hesabini kapatir:
 *  1. Odenmemis tum siparisleri "odendi" olarak isaretler,
 *  2. Hala PENDING/PREPARING olanlari TAMAMLANDI'ya cevirir (masa kalkti, is bitti),
 *  3. Her siparis icin otomatik GELIR kaydini olusturur/gunceller.
 *  4. Yontem "Cari" ise siparisleri musteriye baglar: satis ciroya bugun yazilir,
 *     tahsilat sonradan cari hesaptan alinir (tahsilat ikinci kez gelir yazmaz).
 *
 * (3) kritik: gelir kaydi normalde siparis COMPLETED olunca olusuyor. Hesap
 * kapatilirken hala hazirlanan bir siparis varsa, burada tamamlanmis sayilip
 * geliri de yaziliyor — aksi halde tahsil edilen para ciroya hic girmezdi.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const parsed = closeSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Geçersiz istek" }, { status: 400 });
  }
  const { tableNo, paymentMethod } = parsed.data;
  const isCari = paymentMethod === CARI_METHOD;
  const customerId = isCari ? parsed.data.customerId! : null;

  let customerName: string | null = null;
  let creditLimit: number | null = null;
  if (customerId) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { name: true, isActive: true, creditLimit: true },
    });
    if (!customer || !customer.isActive) {
      return NextResponse.json({ error: "Cari müşteri bulunamadı ya da pasif." }, { status: 400 });
    }
    customerName = customer.name;
    // Limit kontrolu asagida, masa toplami belli olunca yapilir
    creditLimit = customer.creditLimit;
  }

  const open = await prisma.order.findMany({
    where: { tableNo, paidAt: null, status: { not: "CANCELLED" } },
    select: { id: true, orderNo: true, tableNo: true, totalAmount: true, status: true },
  });

  if (open.length === 0) {
    return NextResponse.json({ error: "Bu masada açık hesap yok." }, { status: 400 });
  }

  type OpenOrderRow = { id: string; orderNo: number; tableNo: string; totalAmount: number; status: OrderStatus };
  const rows = open as OpenOrderRow[];
  const ids = rows.map((o) => o.id);
  const total = rows.reduce((sum, o) => sum + o.totalAmount, 0);
  const stillOpen = rows.filter((o) => o.status !== "COMPLETED").length;
  const paidAt = new Date();

  if (customerId && creditLimit != null) {
    const limit = creditLimit;
    const { balance } = await getCustomerBalance(customerId);
    if (balance + total > limit + 0.001) {
      return NextResponse.json(
        {
          error:
            `${customerName} için borç limiti aşılıyor: mevcut borç ${balance.toFixed(2)} ₺, ` +
            `limit ${limit.toFixed(2)} ₺. Önce tahsilat alın ya da limiti yükseltin.`,
        },
        { status: 400 }
      );
    }
  }

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.order.updateMany({
      where: { id: { in: ids } },
      data: { paidAt, paymentMethod, status: "COMPLETED", customerId },
    });

    // Gelir kaydi olmayan siparisler icin olustur (hazirlanirken kapatilanlar)
    const existing = await tx.transaction.findMany({
      where: { orderId: { in: ids }, type: "INCOME" },
      select: { orderId: true },
    });
    const withIncome = new Set(existing.map((t: { orderId: string | null }) => t.orderId));
    const missing = rows.filter((o) => !withIncome.has(o.id));

    if (missing.length > 0) {
      await tx.transaction.createMany({
        data: missing.map((o) => ({
          type: "INCOME" as const,
          amount: o.totalAmount,
          description: `Sipariş #${o.orderNo} · Masa ${o.tableNo}` + (customerName ? ` · ${customerName}` : ""),
          category: `Satış · ${paymentMethod}`,
          orderId: o.id,
          date: paidAt,
        })),
      });
    }

    // Mevcut gelir kayitlarina odeme yontemini isle (finans raporu icin)
    await tx.transaction.updateMany({
      where: { orderId: { in: ids }, type: "INCOME" },
      data: { category: `Satış · ${paymentMethod}` },
    });
  });

  return NextResponse.json({
    ok: true,
    closed: ids.length,
    completed: stillOpen,
    total,
    paymentMethod,
    customerName,
  });
}
