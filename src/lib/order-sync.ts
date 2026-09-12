import type { CancelReason, Prisma } from "@prisma/client";

/**
 * Bir siparisin toplamini iptal edilmemis kalemlere gore yeniden hesaplar ve
 * varsa otomatik gelir kaydini bu tutara esitler.
 *
 * Kalem iptalinde tutarin ve cironun birlikte guncellenmesi sart: aksi halde
 * iptal edilen urun ciroda gorunmeye devam ederdi.
 */
export async function recalcOrder(
  tx: Prisma.TransactionClient,
  orderId: string,
  actorId?: string
) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: { orderItems: { select: { totalPrice: true, cancelledAt: true } } },
  });
  if (!order) return null;

  type Item = { totalPrice: number; cancelledAt: Date | null };
  const items = order.orderItems as Item[];
  const active = items.filter((i) => !i.cancelledAt);
  const total = Math.round(active.reduce((sum, i) => sum + i.totalPrice, 0) * 100) / 100;

  // Tum kalemler iptal edildiyse siparisin kendisi de iptal olur
  const allCancelled = items.length > 0 && active.length === 0;

  const updated = await tx.order.update({
    where: { id: orderId },
    data: {
      totalAmount: total,
      ...(allCancelled && order.status !== "CANCELLED"
        ? {
            status: "CANCELLED" as const,
            cancelledAt: order.cancelledAt ?? new Date(),
            cancelledById: order.cancelledById ?? actorId ?? null,
          }
        : {}),
    },
  });

  // Gelir kaydini tutara esitle
  const income = await tx.transaction.findUnique({ where: { orderId } });
  if (income) {
    if (updated.status === "CANCELLED" || total <= 0) {
      await tx.transaction.delete({ where: { id: income.id } });
    } else if (income.amount !== total) {
      await tx.transaction.update({ where: { id: income.id }, data: { amount: total } });
    }
  }

  return updated;
}

export type CancelInput = {
  reason: CancelReason;
  note?: string | null;
  actorId: string;
};
