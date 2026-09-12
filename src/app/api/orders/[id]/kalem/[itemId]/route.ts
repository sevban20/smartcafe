import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/guards";
import { recalcOrder } from "@/lib/order-sync";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  cancelReason: z.enum(["MUSTERI_VAZGECTI", "YANLIS_GIRILDI", "FIRE", "STOK_YOK", "DIGER"]),
  cancelNote: z.string().max(200).optional().nullable(),
});

/**
 * Tek bir siparis kalemini iptal eder (satir silinmez, iptal isaretlenir).
 * Siparisin toplami ve varsa gelir kaydi otomatik yeniden hesaplanir.
 * Son aktif kalem de iptal edilirse siparis komple CANCELLED olur.
 */
export async function DELETE(
  req: Request,
  { params }: { params: { id: string; itemId: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "İptal nedeni seçilmeli." }, { status: 400 });
  }
  const { cancelReason, cancelNote } = parsed.data;

  const item = await prisma.orderItem.findUnique({
    where: { id: params.itemId },
    include: { order: { select: { id: true, paidAt: true } } },
  });

  if (!item || item.orderId !== params.id) {
    return NextResponse.json({ error: "Sipariş kalemi bulunamadı." }, { status: 404 });
  }
  if (item.cancelledAt) {
    return NextResponse.json({ error: "Bu kalem zaten iptal edilmiş." }, { status: 409 });
  }
  if (item.order.paidAt) {
    return NextResponse.json(
      { error: "Hesabı kapatılmış siparişte değişiklik yapılamaz." },
      { status: 409 }
    );
  }

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.orderItem.update({
      where: { id: params.itemId },
      data: {
        cancelledAt: new Date(),
        cancelledById: user.id,
        cancelReason,
        cancelNote: cancelNote?.trim() || null,
      },
    });
    return recalcOrder(tx, params.id, user.id);
  });

  return NextResponse.json({
    ok: true,
    orderCancelled: result?.status === "CANCELLED",
    newTotal: result?.totalAmount ?? 0,
  });
}
