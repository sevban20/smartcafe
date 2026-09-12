"use client";

import * as React from "react";
import { Minus, Plus, ShoppingBag, Trash2, CheckCircle2 } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { formatPrice } from "@/lib/utils";
import { cartTotal, useCart } from "@/store/cart";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableNo: string;
  onShowMyOrders?: () => void;
  staffMode?: boolean;
};

export function CartDrawer({ open, onOpenChange, tableNo, onShowMyOrders, staffMode = false }: Props) {
  const { items, note, setNote, increment, decrement, removeItem, clear } = useCart();
  const [sending, setSending] = React.useState(false);
  const [successOrderNo, setSuccessOrderNo] = React.useState<number | null>(null);

  const total = cartTotal(items);

  const queryClient = useQueryClient();

  const submit = async () => {
    if (items.length === 0) return;
    setSending(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableNo,
          notes: note || null,
          items: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            choiceIds: i.selectedOptions.map((o) => o.choiceId),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Sipariş gönderilemedi.");
      clear();
      queryClient.invalidateQueries({ queryKey: ["masa-siparisleri"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["hesaplar"] });
      setSuccessOrderNo(data.order.orderNo);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sipariş gönderilemedi.");
    } finally {
      setSending(false);
    }
  };

  const close = () => {
    setSuccessOrderNo(null);
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DrawerContent className="max-h-[92vh]">
        {successOrderNo !== null ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <CheckCircle2 className="h-14 w-14 text-emerald-600" />
            <h2 className="text-xl font-bold">Siparişiniz alındı</h2>
            <p className="text-sm text-muted-foreground">
              Sipariş numaranız <span className="font-semibold text-foreground">#{successOrderNo}</span> ·
              Masa {tableNo}
            </p>
            <p className="text-sm text-muted-foreground">
              {staffMode ? "Sipariş mutfağa iletildi." : "Hazır olduğunda masanıza getireceğiz."}
            </p>
            <div className="mt-4 grid w-full gap-2">
              {onShowMyOrders && (
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    close();
                    onShowMyOrders();
                  }}
                >
                  Siparişlerimi ve Hesabımı Gör
                </Button>
              )}
              <Button className="w-full" size="lg" onClick={close}>
                {staffMode ? "Yeni Sipariş" : "Menüye Dön"}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <DrawerHeader>
              <DrawerTitle>Sepetim</DrawerTitle>
              <DrawerDescription>Masa {tableNo}</DrawerDescription>
            </DrawerHeader>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-4">
              {items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
                  <ShoppingBag className="h-10 w-10" />
                  <p className="text-sm">Sepetiniz boş.</p>
                </div>
              ) : (
                items.map((item) => (
                  <div key={item.lineId} className="rounded-xl border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{item.productName}</p>
                        {item.selectedOptions.length > 0 && (
                          <ul className="mt-1 space-y-0.5">
                            {item.selectedOptions.map((o) => (
                              <li key={o.choiceId} className="text-xs text-muted-foreground">
                                {o.optionName}: <span className="text-foreground">{o.choiceName}</span>
                                {o.extraPrice > 0 ? ` (+${formatPrice(o.extraPrice)})` : ""}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <button
                        onClick={() => removeItem(item.lineId)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                        aria-label="Kaldır"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => decrement(item.lineId)}>
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <span className="w-6 text-center text-sm font-semibold tabular-nums">{item.quantity}</span>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => increment(item.lineId)}>
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <span className="font-semibold tabular-nums">
                        {formatPrice(item.unitPrice * item.quantity)}
                      </span>
                    </div>
                  </div>
                ))
              )}

              {items.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <Label htmlFor="siparis-notu">Sipariş notu (isteğe bağlı)</Label>
                  <Textarea
                    id="siparis-notu"
                    placeholder="Örn. şekersiz olsun, servis birlikte gelsin..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={500}
                  />
                </div>
              )}
            </div>

            {items.length > 0 && (
              <DrawerFooter className="safe-bottom">
                <div className="flex items-center justify-between pb-1">
                  <span className="text-sm text-muted-foreground">Toplam</span>
                  <span className="text-xl font-bold tabular-nums">{formatPrice(total)}</span>
                </div>
                <Separator />
                <Button size="lg" className="mt-2 w-full" onClick={submit} disabled={sending}>
                  {sending ? "Gönderiliyor..." : staffMode ? "Siparişi Mutfağa Gönder" : "Siparişi Gönder"}
                </Button>
              </DrawerFooter>
            )}
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
