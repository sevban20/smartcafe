"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChefHat, Loader2, PlusCircle, RefreshCw, User, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { formatPrice, formatTime, timeAgo } from "@/lib/utils";
import { CANCEL_REASON_LABEL, ORDER_STATUS_CLASS, ORDER_STATUS_LABEL } from "@/lib/constants";
import { toast } from "sonner";
import { flashTitle, playChime, stopFlashTitle, vibrate } from "@/lib/notify";
import { NotificationControls, useSoundEnabled } from "@/components/kds/notification-controls";
import { CancelDialog, type CancelTarget } from "@/components/kds/cancel-dialog";
import type { CancelReason, OrderStatus } from "@prisma/client";

type KdsOrder = {
  id: string;
  orderNo: number;
  tableNo: string;
  status: OrderStatus;
  totalAmount: number;
  notes: string | null;
  source: string;
  takenBy: { name: string } | null;
  cancelledBy: { name: string } | null;
  cancelReason: CancelReason | null;
  cancelNote: string | null;
  createdAt: string;
  orderItems: {
    id: string;
    productName: string;
    quantity: number;
    totalPrice: number;
    cancelledAt: string | null;
    cancelReason: CancelReason | null;
    selectedOptions: { id: string; optionName: string; choiceName: string; extraPrice: number }[];
  }[];
};

const FILTERS = [
  { key: "AKTIF", label: "Aktif", statuses: "PENDING,PREPARING" },
  { key: "PENDING", label: "Bekleyen", statuses: "PENDING" },
  { key: "PREPARING", label: "Hazırlanan", statuses: "PREPARING" },
  { key: "COMPLETED", label: "Tamamlanan", statuses: "COMPLETED" },
  { key: "CANCELLED", label: "İptal", statuses: "CANCELLED" },
] as const;

export function KdsBoard({
  userName,
  accessDenied = false,
}: { userName?: string; accessDenied?: boolean } = {}) {
  const [filter, setFilter] = React.useState<(typeof FILTERS)[number]["key"]>("AKTIF");
  const [onlyMine, setOnlyMine] = React.useState(false);
  const queryClient = useQueryClient();
  const statuses = FILTERS.find((f) => f.key === filter)!.statuses;

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["orders", statuses, onlyMine],
    queryFn: async () => {
      const res = await fetch(`/api/orders?status=${statuses}${onlyMine ? "&benim=1" : ""}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Siparişler alınamadı");
      return (await res.json()) as { orders: KdsOrder[] };
    },
    refetchInterval: 10_000,
  });

  const mutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OrderStatus }) => {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Durum güncellenemedi");
      return json;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success(`Sipariş ${ORDER_STATUS_LABEL[vars.status].toLowerCase()} olarak işaretlendi`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Durum güncellenemedi."),
  });

  const orders = React.useMemo(() => data?.orders ?? [], [data]);

  // --- Yeni siparis uyarisi ---
  const { soundOn, toggle: toggleSound } = useSoundEnabled();
  const seenIds = React.useRef<Set<string> | null>(null);
  const [newCount, setNewCount] = React.useState(0);
  const [cancelTarget, setCancelTarget] = React.useState<CancelTarget | null>(null);

  React.useEffect(() => {
    if (!data) return;
    const ids = new Set(orders.map((o) => o.id));

    // Ilk yuklemede uyari verme, sadece mevcut durumu kaydet
    if (seenIds.current === null) {
      seenIds.current = ids;
      return;
    }

    const fresh = orders.filter((o) => o.status === "PENDING" && !seenIds.current!.has(o.id));
    seenIds.current = ids;
    if (fresh.length === 0) return;

    setNewCount((c) => c + fresh.length);
    if (soundOn) playChime();
    vibrate();
    flashTitle(`(${fresh.length}) Yeni sipariş!`);
    toast.info(
      fresh.length === 1
        ? `Yeni sipariş: Masa ${fresh[0].tableNo}`
        : `${fresh.length} yeni sipariş geldi`
    );
  }, [data, orders, soundOn]);

  // Yetkisiz bir ekrana girmeye calisildiysa bir kez bilgi ver
  React.useEffect(() => {
    if (accessDenied) toast.error("Bu ekran yalnızca yöneticiler içindir.");
  }, [accessDenied]);

  const clearNew = () => {
    setNewCount(0);
    stopFlashTitle();
  };

  return (
    <div className="min-h-[100dvh] bg-background pb-8">
      <header className="sticky top-0 z-30 border-b bg-background/95 px-4 py-3 backdrop-blur safe-top">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-lg font-bold leading-tight">
              Sipariş Ekranı
              {newCount > 0 && (
                <button
                  onClick={clearNew}
                  className="animate-pulse rounded-full bg-destructive px-2 py-0.5 text-xs font-bold text-destructive-foreground"
                >
                  {newCount} yeni
                </button>
              )}
            </h1>
            <p className="text-xs text-muted-foreground">
              {orders.length} sipariş · 10 saniyede bir yenilenir
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="icon" aria-label="Açık hesaplar" title="Açık hesaplar">
              <Link href="/hesaplar">
                <Wallet className="h-4 w-4" />
              </Link>
            </Button>
            <NotificationControls soundOn={soundOn} onToggleSound={toggleSound} />
            <Button variant="outline" size="icon" onClick={() => refetch()} aria-label="Yenile">
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        <Button asChild className="mt-3 w-full" size="lg">
          <Link href="/siparis">
            <PlusCircle className="h-5 w-5" />
            Sipariş Al (masa için)
          </Link>
        </Button>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)} className="mt-3">
          <TabsList className="no-scrollbar w-full justify-start overflow-x-auto">
            {FILTERS.map((f) => (
              <TabsTrigger key={f.key} value={f.key} className="flex-1">
                {f.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <label className="mt-2 flex items-center justify-between rounded-lg border px-3 py-2">
          <span className="text-xs font-medium">
            Yalnızca benim aldıklarım
            {userName ? ` · ${userName}` : ""}
          </span>
          <Switch checked={onlyMine} onCheckedChange={setOnlyMine} />
        </label>
      </header>

      <div className="space-y-3 p-4">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : orders.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Bu listede sipariş yok.</p>
        ) : (
          orders.map((order) => (
            <Card key={order.id} className="overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-4 py-3">
                <div>
                  <p className="text-base font-bold leading-tight">Masa {order.tableNo}</p>
                  <p className="text-xs text-muted-foreground">
                    #{order.orderNo} · {formatTime(order.createdAt)} · {timeAgo(order.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {order.source === "PERSONEL" && (
                    <Badge variant="outline" className="gap-1 border-indigo-200 bg-indigo-100 text-indigo-800">
                      <User className="h-3 w-3" />
                      {order.takenBy?.name ?? "Garson"}
                    </Badge>
                  )}
                  <Badge variant="outline" className={ORDER_STATUS_CLASS[order.status]}>
                    {ORDER_STATUS_LABEL[order.status]}
                  </Badge>
                </div>
              </div>

              <ul className="divide-y">
                {order.orderItems.map((item) => (
                  <li key={item.id} className={`flex gap-3 px-4 py-3 ${item.cancelledAt ? "bg-muted/40" : ""}`}>
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm font-bold ${
                        item.cancelledAt
                          ? "bg-muted text-muted-foreground line-through"
                          : "bg-primary text-primary-foreground"
                      }`}
                    >
                      {item.quantity}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`font-semibold leading-tight ${
                          item.cancelledAt ? "text-muted-foreground line-through" : ""
                        }`}
                      >
                        {item.productName}
                      </p>
                      {item.cancelledAt && (
                        <p className="text-xs font-medium text-rose-700">
                          İptal · {item.cancelReason ? CANCEL_REASON_LABEL[item.cancelReason] : ""}
                        </p>
                      )}
                      {!item.cancelledAt && item.selectedOptions.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {item.selectedOptions.map((o) => (
                            <span
                              key={o.id}
                              className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900"
                            >
                              {o.choiceName}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span
                      className={`shrink-0 text-sm tabular-nums ${
                        item.cancelledAt ? "text-muted-foreground line-through" : "text-muted-foreground"
                      }`}
                    >
                      {formatPrice(item.totalPrice)}
                    </span>
                    {!item.cancelledAt && order.status !== "CANCELLED" && order.status !== "COMPLETED" && (
                      <button
                        onClick={() =>
                          setCancelTarget({
                            kind: "item",
                            orderId: order.id,
                            itemId: item.id,
                            label: `${item.quantity}× ${item.productName}`,
                          })
                        }
                        className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                        aria-label="Kalemi iptal et"
                        title="Bu kalemi iptal et"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>

              {order.notes && (
                <p className="border-t bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
                  <span className="font-semibold">Not:</span> {order.notes}
                </p>
              )}

              {order.status === "CANCELLED" && order.cancelReason && (
                <p className="border-t bg-rose-50 px-4 py-2.5 text-sm text-rose-900">
                  <span className="font-semibold">İptal:</span>{" "}
                  {CANCEL_REASON_LABEL[order.cancelReason]}
                  {order.cancelledBy ? ` · ${order.cancelledBy.name}` : ""}
                  {order.cancelNote ? ` · ${order.cancelNote}` : ""}
                </p>
              )}

              <div className="flex items-center justify-between border-t px-4 py-3">
                <span className="font-bold tabular-nums">{formatPrice(order.totalAmount)}</span>
                <div className="flex gap-2">
                  {(order.status === "PENDING" || order.status === "PREPARING") && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCancelTarget({
                          kind: "order",
                          orderId: order.id,
                          label: `Masa ${order.tableNo} · #${order.orderNo}`,
                        })
                      }
                    >
                      <X className="h-4 w-4" />
                      İptal
                    </Button>
                  )}
                  {order.status === "PENDING" && (
                    <Button
                      size="sm"
                      onClick={() => mutation.mutate({ id: order.id, status: "PREPARING" })}
                      disabled={mutation.isPending}
                    >
                      <ChefHat className="h-4 w-4" />
                      Hazırla
                    </Button>
                  )}
                  {order.status === "PREPARING" && (
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() => mutation.mutate({ id: order.id, status: "COMPLETED" })}
                      disabled={mutation.isPending}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Teslim Et
                    </Button>
                  )}
                  {order.status === "COMPLETED" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => mutation.mutate({ id: order.id, status: "PREPARING" })}
                      disabled={mutation.isPending}
                    >
                      Geri Al
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <CancelDialog target={cancelTarget} onClose={() => setCancelTarget(null)} />
    </div>
  );
}
