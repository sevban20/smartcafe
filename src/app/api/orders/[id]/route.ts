import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/guards";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const patchSchema = z
  .object({
    status: z.enum(["PENDING", "PREPARING", "COMPLETED", "CANCELLED"]),
    cancelReason: z
      .enum(["MUSTERI_VAZGECTI", "YANLIS_GIRILDI", "FIRE", "STOK_YOK", "DIGER"])
      .optional(),
    cancelNote: z.string().max(200).optional().nullable(),
  })
  .refine((v) => v.status !== "CANCELLED" || Boolean(v.cancelReason), {
    message: "İptal nedeni seçilmeli.",
    path: ["cancelReason"],
  });

/**
 * Siparis durumunu gunceller.
 *
 * Kurallar:
 *  - COMPLETED olunca otomatik GELIR kaydi olusur.
 *  - CANCELLED icin NEDEN ZORUNLU; kim/ne zaman/neden iptal ettigi kaydedilir.
 *  - Hesabi kapatilmis (tahsil edilmis) siparis degistirilemez.
 *  - Iptal, hazirlanmakta olan siparisler icin de mumkundur (musteri kalkabilir).
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Geçersiz istek" },
      { status: 400 }
    );
  }
  const { status, cancelReason, cancelNote } = parsed.data;

  const order = await prisma.order.findUnique({ where: { id: params.id } });
  if (!order) return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });

  // Hesabi kapatilmis (tahsil edilmis) bir siparis geri alinamaz:
  // aksi halde gelir kaydi silinir ama para tahsil edilmis kalirdi.
  if (order.paidAt && status !== "COMPLETED") {
    return NextResponse.json(
      {
        error:
          "Bu siparişin hesabı kapatılmış, durumu değiştirilemez. Hatalı tahsilat için finanstan iade girin.",
      },
      { status: 409 }
    );
  }

  const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const now = new Date();

    await tx.order.update({
      where: { id: params.id },
      data: {
        status,
        ...(status === "CANCELLED"
          ? {
              cancelledAt: now,
              cancelledById: user.id,
              cancelReason,
              cancelNote: cancelNote?.trim() || null,
            }
          : {
              // Iptalden geri donuluyorsa izi temizle
              cancelledAt: null,
              cancelledById: null,
              cancelReason: null,
              cancelNote: null,
            }),
      },
    });

    if (status === "CANCELLED") {
      // Siparis tumden iptal edildiyse kalemleri de iptal isaretle (rapor tutarli olsun)
      await tx.orderItem.updateMany({
        where: { orderId: params.id, cancelledAt: null },
        data: { cancelledAt: now, cancelledById: user.id, cancelReason, cancelNote: cancelNote?.trim() || null },
      });
      await tx.transaction.deleteMany({ where: { orderId: params.id, type: "INCOME" } });
    }

    if (status === "COMPLETED") {
      const fresh = await tx.order.findUnique({ where: { id: params.id } });
      const existing = await tx.transaction.findUnique({ where: { orderId: params.id } });
      if (!existing && fresh && fresh.totalAmount > 0) {
        await tx.transaction.create({
          data: {
            type: "INCOME",
            amount: fresh.totalAmount,
            description: `Sipariş #${fresh.orderNo} · Masa ${fresh.tableNo}`,
            category: "Satış",
            orderId: fresh.id,
            date: now,
          },
        });
      }
    } else if (status !== "CANCELLED") {
      // Tamamlanmis durumdan cikildiysa otomatik gelir kaydini geri al
      await tx.transaction.deleteMany({ where: { orderId: params.id, type: "INCOME" } });
    }

    return tx.order.findUnique({
      where: { id: params.id },
      include: { orderItems: { include: { selectedOptions: true } } },
    });
  });

  return NextResponse.json({ order: updated });
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: { orderItems: { include: { selectedOptions: true } } },
  });
  if (!order) return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
  return NextResponse.json({ order });
}
