import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatPrice, formatTime } from "@/lib/utils";
import { CANCEL_REASON_LABEL, ORDER_STATUS_CLASS, ORDER_STATUS_LABEL } from "@/lib/constants";
import type { Metadata } from "next";
import type { OrderStatus } from "@prisma/client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Siparişler" };

const FILTERS: { key: string; label: string; statuses?: OrderStatus[]; unpaid?: boolean }[] = [
  { key: "hepsi", label: "Tümü" },
  { key: "aktif", label: "Aktif", statuses: ["PENDING", "PREPARING"] },
  { key: "tamamlanan", label: "Tamamlanan", statuses: ["COMPLETED"] },
  { key: "iptal", label: "İptal", statuses: ["CANCELLED"] },
  { key: "acik", label: "Ödenmemiş", unpaid: true },
];

export default async function SiparislerPage({ searchParams }: { searchParams: { durum?: string } }) {
  const active = FILTERS.find((f) => f.key === searchParams.durum) ?? FILTERS[0];

  const orders = await prisma.order.findMany({
    where: active.unpaid
      ? { paidAt: null, status: { not: "CANCELLED" } }
      : active.statuses
        ? { status: { in: active.statuses } }
        : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      orderItems: { include: { selectedOptions: true } },
      cancelledBy: { select: { name: true } },
      customer: { select: { id: true, name: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Siparişler</h1>
        <p className="text-sm text-muted-foreground">Son 100 sipariş</p>
      </div>

      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <a
            key={f.key}
            href={`/yonetim/siparisler?durum=${f.key}`}
            className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm ${
              active.key === f.key ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {f.label}
          </a>
        ))}
      </div>

      {orders.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Sipariş bulunamadı.</Card>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Card key={order.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    Masa {order.tableNo} · #{order.orderNo}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(order.createdAt)} {formatTime(order.createdAt)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {order.source === "PERSONEL" && (
                    <Badge variant="outline" className="border-indigo-200 bg-indigo-100 text-indigo-800">
                      Garson
                    </Badge>
                  )}
                  {order.paidAt && order.customer ? (
                    <a href={`/yonetim/cari/${order.customer.id}`}>
                      <Badge variant="outline" className="border-violet-200 bg-violet-100 text-violet-800">
                        Cariye yazıldı · {order.customer.name}
                      </Badge>
                    </a>
                  ) : order.paidAt ? (
                    <Badge variant="outline" className="border-emerald-200 bg-emerald-100 text-emerald-800">
                      Ödendi{order.paymentMethod ? ` · ${order.paymentMethod}` : ""}
                    </Badge>
                  ) : null}
                  <Badge variant="outline" className={ORDER_STATUS_CLASS[order.status]}>
                    {ORDER_STATUS_LABEL[order.status]}
                  </Badge>
                  <span className="font-bold tabular-nums">{formatPrice(order.totalAmount)}</span>
                </div>
              </div>

              <ul className="mt-3 space-y-1.5 border-t pt-3">
                {order.orderItems.map((item) => (
                  <li key={item.id} className="text-sm">
                    <span className={`font-medium ${item.cancelledAt ? "text-muted-foreground line-through" : ""}`}>
                      {item.quantity}× {item.productName}
                    </span>
                    {item.cancelledAt && (
                      <span className="ml-2 text-xs text-rose-700">
                        iptal{item.cancelReason ? ` · ${CANCEL_REASON_LABEL[item.cancelReason]}` : ""}
                      </span>
                    )}
                    {item.selectedOptions.length > 0 && (
                      <span className="text-muted-foreground">
                        {" — "}
                        {item.selectedOptions.map((o) => o.choiceName).join(", ")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>

              {order.notes && (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <span className="font-semibold">Not:</span> {order.notes}
                </p>
              )}

              {order.status === "CANCELLED" && (
                <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-900">
                  <span className="font-semibold">İptal:</span>{" "}
                  {order.cancelReason ? CANCEL_REASON_LABEL[order.cancelReason] : "neden belirtilmemiş"}
                  {order.cancelledBy ? ` · ${order.cancelledBy.name}` : ""}
                  {order.cancelNote ? ` · ${order.cancelNote}` : ""}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
