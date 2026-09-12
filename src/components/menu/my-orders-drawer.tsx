"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChefHat, Clock, Loader2, ReceiptText } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatPrice, formatTime } from "@/lib/utils";
import { ORDER_STATUS_LABEL } from "@/lib/constants";

type TableOrder = {
  id: string;
  orderNo: number;
  status: "PENDING" | "PREPARING" | "COMPLETED";
  totalAmount: number;
  notes: string | null;
  createdAt: string;
  orderItems: {
    id: string;
    productName: string;
    quantity: number;
    totalPrice: number;
    selectedOptions: { id: string; optionName: string; choiceName: string }[];
  }[];
};

const STATUS_ICON = {
  PENDING: Clock,
  PREPARING: ChefHat,
  COMPLETED: CheckCircle2,
} as const;

const STATUS_STYLE = {
  PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  PREPARING: "bg-blue-100 text-blue-800 border-blue-200",
  COMPLETED: "bg-emerald-100 text-emerald-800 border-emerald-200",
} as const;

export function MyOrdersDrawer({
  open,
  onOpenChange,
  tableNo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableNo: string;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["masa-siparisleri", tableNo],
    queryFn: async () => {
      const res = await fetch(`/api/masa/${encodeURIComponent(tableNo)}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Siparişler alınamadı");
      return (await res.json()) as { orders: TableOrder[]; total: number };
    },
    enabled: open,
    refetchInterval: open ? 15_000 : false,
  });

  const orders = data?.orders ?? [];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Siparişlerim</DrawerTitle>
          <DrawerDescription>Masa {tableNo} · bugünkü siparişler</DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-4">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
              <ReceiptText className="h-10 w-10" />
              <p className="text-sm">Bugün bu masadan henüz sipariş verilmemiş.</p>
            </div>
          ) : (
            orders.map((order) => {
              const Icon = STATUS_ICON[order.status];
              return (
                <div key={order.id} className="rounded-xl border">
                  <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2.5">
                    <div>
                      <p className="text-sm font-semibold">Sipariş #{order.orderNo}</p>
                      <p className="text-xs text-muted-foreground">{formatTime(order.createdAt)}</p>
                    </div>
                    <Badge variant="outline" className={`gap-1 ${STATUS_STYLE[order.status]}`}>
                      <Icon className="h-3 w-3" />
                      {ORDER_STATUS_LABEL[order.status]}
                    </Badge>
                  </div>

                  <ul className="divide-y">
                    {order.orderItems.map((item) => (
                      <li key={item.id} className="flex gap-3 px-3 py-2">
                        <span className="text-sm font-semibold tabular-nums">{item.quantity}×</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm leading-tight">{item.productName}</p>
                          {item.selectedOptions.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {item.selectedOptions.map((o) => o.choiceName).join(", ")}
                            </p>
                          )}
                        </div>
                        <span className="text-sm tabular-nums text-muted-foreground">
                          {formatPrice(item.totalPrice)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="flex items-center justify-between border-t px-3 py-2">
                    <span className="text-xs text-muted-foreground">Sipariş tutarı</span>
                    <span className="text-sm font-semibold tabular-nums">{formatPrice(order.totalAmount)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {orders.length > 0 && (
          <DrawerFooter className="safe-bottom">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Ödenecek toplam</p>
                <p className="text-xs text-muted-foreground">İptal edilenler hariç</p>
              </div>
              <span className="text-2xl font-bold tabular-nums">{formatPrice(data?.total ?? 0)}</span>
            </div>
            <Separator />
            <p className="pt-1 text-center text-xs text-muted-foreground">
              Ödeme için kasaya masa numaranızı söylemeniz yeterli.
            </p>
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  );
}
