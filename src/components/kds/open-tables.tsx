"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, ArrowLeftRight, BookUser, Loader2, RefreshCw, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatPrice, formatTime, timeAgo } from "@/lib/utils";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/constants";
import { CariPicker } from "@/components/kds/cari-picker";
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
    movedFromTable: string | null;
    orderItems: { id: string; productName: string; quantity: number; totalPrice: number }[];
  }[];
};

export function OpenTables({ embedded = false }: { embedded?: boolean }) {
  const queryClient = useQueryClient();
  const [active, setActive] = React.useState<OpenTable | null>(null);
  /** Hesap dialogunda "Cariye Yaz" bolumu acik mi */
  const [cariOpen, setCariOpen] = React.useState(false);

  // --- Masa aktarimi ---
  // Masanin kendisini degil numarasini tutuyoruz: dialog acikken liste
  // yenilendiginde (15 sn) ekrandaki adisyon da tazelensin, donmus kalmasin.
  const [transferTableNo, setTransferTableNo] = React.useState<string | null>(null);
  const [hedefMasa, setHedefMasa] = React.useState("");
  const [seciliSiparisler, setSeciliSiparisler] = React.useState<string[]>([]);
  const [birlesmeUyarisi, setBirlesmeUyarisi] = React.useState<{
    siparis: number;
    tutar: number;
  } | null>(null);

  const aktarimiBaslat = (table: OpenTable) => {
    setHedefMasa("");
    setSeciliSiparisler(table.orders.map((o) => o.id));
    setBirlesmeUyarisi(null);
    setTransferTableNo(table.tableNo);
  };

  const aktarimiKapat = () => {
    setTransferTableNo(null);
    setBirlesmeUyarisi(null);
  };

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
    mutationFn: async ({
      tableNo,
      paymentMethod,
      customerId,
    }: {
      tableNo: string;
      paymentMethod: PaymentMethod | "Cari";
      customerId?: string;
    }) => {
      const res = await fetch("/api/hesaplar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableNo, paymentMethod, customerId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Hesap kapatılamadı");
      return json as {
        closed: number;
        completed: number;
        total: number;
        paymentMethod: string;
        customerName: string | null;
      };
    },
    onSuccess: (result, vars) => {
      queryClient.invalidateQueries({ queryKey: ["hesaplar"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["cari-musteriler"] });
      setActive(null);
      setCariOpen(false);
      toast.success(
        `Masa ${vars.tableNo} kapatıldı · ${formatPrice(result.total)} · ` +
          (result.customerName ? `${result.customerName} carisine yazıldı` : result.paymentMethod) +
          (result.completed > 0 ? ` · ${result.completed} sipariş tamamlandı sayıldı` : "")
      );
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Hesap kapatılamadı"),
  });

  type AktarimHatasi = Error & { needsMerge?: boolean; hedefSiparis?: number; hedefTutar?: number };

  const transfer = useMutation({
    mutationFn: async (vars: {
      fromTable: string;
      toTable: string;
      orderIds: string[];
      mergeOnay: boolean;
    }) => {
      const res = await fetch("/api/hesaplar/aktar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vars),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(json?.error ?? "Masa aktarılamadı") as AktarimHatasi;
        if (json?.needsMerge) {
          err.needsMerge = true;
          err.hedefSiparis = json.hedefSiparis;
          err.hedefTutar = json.hedefTutar;
        }
        throw err;
      }
      return json as {
        fromTable: string;
        toTable: string;
        moved: number;
        amount: number;
        merged: boolean;
        partial: boolean;
      };
    },
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["hesaplar"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      aktarimiKapat();
      toast.success(
        `Masa ${r.fromTable} → Masa ${r.toTable} · ${r.moved} sipariş · ${formatPrice(r.amount)}` +
          (r.merged ? " · hesaplar birleştirildi" : "") +
          (r.partial ? ` · Masa ${r.fromTable} hâlâ açık` : "")
      );
    },
    onError: (error) => {
      const e = error as AktarimHatasi;
      // Sunucu "durum degisti" diyorsa ekrandaki listeyi hemen tazele
      queryClient.invalidateQueries({ queryKey: ["hesaplar"] });
      // Hedef masada acik hesap varsa dialogda onay isteriz, toast ile gecistirmeyiz
      if (e.needsMerge) {
        setBirlesmeUyarisi({ siparis: e.hedefSiparis ?? 0, tutar: e.hedefTutar ?? 0 });
        return;
      }
      toast.error(e.message || "Masa aktarılamadı");
    },
  });

  const tables = data?.tables ?? [];
  const transferFrom = transferTableNo
    ? tables.find((t) => t.tableNo === transferTableNo) ?? null
    : null;
  // Secim, listede hala duran siparislere daraltilir (arada odenmis/iptal olmus olabilir)
  const gecerliSecim = transferFrom
    ? transferFrom.orders.filter((o) => seciliSiparisler.includes(o.id)).map((o) => o.id)
    : [];
  const seciliTutar =
    transferFrom?.orders
      .filter((o) => gecerliSecim.includes(o.id))
      .reduce((sum, o) => sum + o.totalAmount, 0) ?? 0;

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

                {table.orders.some((o) => o.movedFromTable) && (
                  <p className="mt-1 text-xs font-medium text-indigo-700">
                    <ArrowLeftRight className="mr-1 inline h-3 w-3" />
                    Masa{" "}
                    {Array.from(
                      new Set(table.orders.map((o) => o.movedFromTable).filter(Boolean))
                    ).join(", ")}{" "}
                    adisyonu buraya aktarıldı
                  </p>
                )}

                <p className="mt-3 text-2xl font-bold tabular-nums">{formatPrice(table.total)}</p>

                <div className="mt-3 flex gap-2">
                  <Button className="flex-1" onClick={() => setActive(table)}>
                    <Wallet className="h-4 w-4" />
                    Hesabı Kapat
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => aktarimiBaslat(table)}
                    title="Adisyonu başka masaya aktar"
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                    Aktar
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={active !== null}
        onOpenChange={(v) => {
          if (!v) {
            setActive(null);
            setCariOpen(false);
          }
        }}
      >
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

              {/* Veresiye: borcu duzenli musterinin cari hesabina yaz */}
              {cariOpen ? (
                <CariPicker
                  key={active.tableNo}
                  total={active.total}
                  pending={close.isPending}
                  onConfirm={(customerId) =>
                    close.mutate({ tableNo: active.tableNo, paymentMethod: "Cari", customerId })
                  }
                />
              ) : (
                <Button
                  variant="outline"
                  className="w-full border-dashed"
                  disabled={close.isPending}
                  onClick={() => setCariOpen(true)}
                >
                  <BookUser className="h-4 w-4" />
                  Cariye Yaz (sonra ödeyecek)
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* --- Masa aktarimi --- */}
      <Dialog
        open={transferTableNo !== null}
        onOpenChange={(v) => {
          if (!v) aktarimiKapat();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Masa {transferFrom?.tableNo} · Adisyonu Aktar</DialogTitle>
            <DialogDescription>
              Müşteri başka masaya geçtiyse siparişleri oraya taşıyın. Kaynak masa boşalır, mutfak
              yeni masayı görür.
            </DialogDescription>
          </DialogHeader>

          {transferFrom && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="hedef-masa">Yeni masa numarası</Label>
                <Input
                  id="hedef-masa"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="Örn. 3"
                  value={hedefMasa}
                  onChange={(e) => {
                    setHedefMasa(e.target.value);
                    setBirlesmeUyarisi(null);
                  }}
                />
                {tables.filter((t) => t.tableNo !== transferFrom.tableNo).length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-xs text-muted-foreground">Açık masalar:</span>
                    {tables
                      .filter((t) => t.tableNo !== transferFrom.tableNo)
                      .map((t) => (
                        <button
                          key={t.tableNo}
                          type="button"
                          onClick={() => {
                            setHedefMasa(t.tableNo);
                            setBirlesmeUyarisi(null);
                          }}
                          className={`rounded-md border px-2 py-0.5 text-xs font-medium ${
                            hedefMasa === t.tableNo
                              ? "border-primary bg-primary text-primary-foreground"
                              : "bg-muted/50 hover:bg-muted"
                          }`}
                        >
                          {t.tableNo}
                        </button>
                      ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Taşınacak siparişler</p>
                  {gecerliSecim.length < transferFrom.orders.length && (
                    <button
                      type="button"
                      className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                      onClick={() => {
                        setSeciliSiparisler(transferFrom.orders.map((o) => o.id));
                        setBirlesmeUyarisi(null);
                      }}
                    >
                      Tümünü seç
                    </button>
                  )}
                </div>
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2">
                  {transferFrom.orders.map((order) => {
                    const secili = gecerliSecim.includes(order.id);
                    return (
                      <label
                        key={order.id}
                        className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/60"
                      >
                        <Checkbox
                          checked={secili}
                          onCheckedChange={(v) => {
                            setSeciliSiparisler((prev) =>
                              v === true ? [...prev, order.id] : prev.filter((id) => id !== order.id)
                            );
                            setBirlesmeUyarisi(null);
                          }}
                        />
                        <span className="min-w-0 flex-1 text-sm">
                          <span className="font-semibold">#{order.orderNo}</span>{" "}
                          <span className="text-muted-foreground">
                            {formatTime(order.createdAt)} · {order.orderItems.length} kalem
                          </span>
                        </span>
                        <span className="shrink-0 text-sm tabular-nums">
                          {formatPrice(order.totalAmount)}
                        </span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Masa bölündüyse yalnızca gidenlerin siparişlerini seçin; kalanlar bu masada açık
                  kalır.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{gecerliSecim.length} sipariş taşınacak</span>
                <span className="text-xl font-bold tabular-nums">{formatPrice(seciliTutar)}</span>
              </div>

              {birlesmeUyarisi && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <span className="font-semibold">Masa {hedefMasa.trim()} zaten açık</span> —{" "}
                  {birlesmeUyarisi.siparis} sipariş, {formatPrice(birlesmeUyarisi.tutar)}. Devam
                  ederseniz iki adisyon <span className="font-semibold">birleşir</span> ve tek hesap
                  olarak kapanır. Bu işlem geri alınamaz.
                </p>
              )}

              <Separator />

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={aktarimiKapat}
                  disabled={transfer.isPending}
                >
                  Vazgeç
                </Button>
                <Button
                  className="flex-1"
                  disabled={
                    transfer.isPending ||
                    hedefMasa.trim().length === 0 ||
                    hedefMasa.trim() === transferFrom.tableNo ||
                    gecerliSecim.length === 0
                  }
                  onClick={() =>
                    transfer.mutate({
                      fromTable: transferFrom.tableNo,
                      toTable: hedefMasa.trim(),
                      orderIds: gecerliSecim,
                      mergeOnay: birlesmeUyarisi !== null,
                    })
                  }
                >
                  {transfer.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowLeftRight className="h-4 w-4" />
                  )}
                  {birlesmeUyarisi ? "Birleştir ve Aktar" : "Aktar"}
                </Button>
              </div>
            </div>
          )}

          {transferTableNo && !transferFrom && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Masa {transferTableNo} artık açık değil — hesap bu sırada kapatılmış olabilir.
              </p>
              <Button className="w-full" onClick={aktarimiKapat}>
                Kapat
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
