"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Loader2, RefreshCw, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatPrice, formatTime, timeAgo } from "@/lib/utils";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/constants";
import { toast } from "sonner";

type OpenTable = {
  tableNo: string;
  total: number;
  orderCount: number;
  openedAt: string;
  hasUnfinished: boolean;
  orders: {
    id: string;
    orderNo: number;
    status: string;
    totalAmount: number;
    createdAt: string;
    orderItems: { id: string; productName: string; quantity: number; totalPrice: number }[];
  }[];
};

export function OpenTables({ embedded = false }: { embedded?: boolean }) {
  const queryClient = useQueryClient();
  const [active, setActive] = React.useState<OpenTable | null>(null);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["hesaplar"],
    queryFn: async () => {
      const res = await fetch("/api/hesaplar", { cache: "no-store" });
      if (!res.ok) throw new Error("Hesaplar alınamadı");
      return (await res.json()) as { tables: OpenTable[]; grandTotal: number };
    },
    refetchInterval: 15_000,
  });

  const close = useMutation({
    mutationFn: async ({ tableNo, paymentMethod }: { tableNo: string; paymentMethod: PaymentMethod }) => {
      const res = await fetch("/api/hesaplar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableNo, paymentMethod }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Hesap kapatılamadı");
      return json as { closed: number; completed: number; total: number; paymentMethod: string };
    },
    onSuccess: (result, vars) => {
      queryClient.invalidateQueries({ queryKey: ["hesaplar"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setActive(null);
      toast.success(
        `Masa ${vars.tableNo} kapatıldı · ${formatPrice(result.total)} · ${result.paymentMethod}` +
          (result.completed > 0 ? ` · ${result.completed} sipariş tamamlandı sayıldı` : "")
      );
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Hesap kapatılamadı"),
  });

  const tables = data?.tables ?? [];

  const header = (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        {!embedded && (
          <Button asChild variant="ghost" size="icon" aria-label="Sipariş ekranı">
            <Link href="/kds">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
        )}
        <div className="min-w-0">
          <h1 className="text-lg font-bold leading-tight">Açık Hesaplar</h1>
          <p className="text-xs text-muted-foreground">
            {tables.length} masa · toplam {formatPrice(data?.grandTotal ?? 0)}
          </p>
        </div>
      </div>
      <Button variant="outline" size="icon" onClick={() => refetch()} aria-label="Yenile">
        <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
      </Button>
    </div>
  );

  return (
    <div className={embedded ? "space-y-4" : "min-h-[100dvh] bg-background pb-8"}>
      {embedded ? (
        header
      ) : (
        <header className="sticky top-0 z-30 border-b bg-background/95 px-4 py-3 backdrop-blur safe-top">
          {header}
        </header>
      )}

      <div className={embedded ? "space-y-3" : "space-y-3 p-4"}>
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : tables.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <Wallet className="h-10 w-10" />
            <p className="text-sm">Açık hesap yok. Tüm masalar kapalı.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tables.map((table) => (
              <Card key={table.tableNo} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-lg font-bold leading-tight">Masa {table.tableNo}</p>
                    <p className="text-xs text-muted-foreground">
                      {table.orderCount} sipariş · {formatTime(table.openedAt)} ({timeAgo(table.openedAt)})
                    </p>
                  </div>
                  {table.hasUnfinished && (
                    <Badge variant="outline" className="gap-1 border-amber-200 bg-amber-100 text-amber-800">
                      <AlertTriangle className="h-3 w-3" />
                      Hazırlanıyor
                    </Badge>
                  )}
                </div>

                <p className="mt-3 text-2xl font-bold tabular-nums">{formatPrice(table.total)}</p>

                <Button className="mt-3 w-full" onClick={() => setActive(table)}>
                  <Wallet className="h-4 w-4" />
                  Hesabı Kapat
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={active !== null} onOpenChange={(v) => !v && setActive(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Masa {active?.tableNo} · Hesap</DialogTitle>
            <DialogDescription>Ödeme yöntemini seçin. Hesap kapanınca müşteri ekranı sıfırlanır.</DialogDescription>
          </DialogHeader>

          {active && (
            <div className="space-y-3">
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border p-3">
                {active.orders.map((order) => (
                  <div key={order.id}>
                    <p className="text-xs font-semibold text-muted-foreground">
                      #{order.orderNo} · {formatTime(order.createdAt)}
                    </p>
                    <ul className="mt-0.5">
                      {order.orderItems.map((item) => (
                        <li key={item.id} className="flex justify-between text-sm">
                          <span>
                            {item.quantity}× {item.productName}
                          </span>
                          <span className="tabular-nums text-muted-foreground">
                            {formatPrice(item.totalPrice)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Toplam</span>
                <span className="text-2xl font-bold tabular-nums">{formatPrice(active.total)}</span>
              </div>

              {active.hasUnfinished && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Bu masada henüz teslim edilmemiş sipariş var. Hesabı kapatırsanız bunlar da
                  <span className="font-semibold"> tamamlandı</span> sayılır ve ciroya yazılır.
                </p>
              )}

              <Separator />

              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_METHODS.map((method) => (
                  <Button
                    key={method}
                    variant={method === "Nakit" ? "default" : "outline"}
                    disabled={close.isPending}
                    onClick={() => close.mutate({ tableNo: active.tableNo, paymentMethod: method })}
                  >
                    {close.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : method}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
