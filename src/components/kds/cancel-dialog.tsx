"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CANCEL_REASONS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { CancelReason } from "@prisma/client";

export type CancelTarget =
  | { kind: "order"; orderId: string; label: string }
  | { kind: "item"; orderId: string; itemId: string; label: string };

/**
 * Iptal penceresi. Neden secimi ZORUNLU — iptaller rapora islenir,
 * kimin neyi neden iptal ettigi kayit altina alinir.
 */
export function CancelDialog({
  target,
  onClose,
}: {
  target: CancelTarget | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [reason, setReason] = React.useState<CancelReason | null>(null);
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (target) {
      setReason(null);
      setNote("");
    }
  }, [target]);

  const submit = async () => {
    if (!target || !reason) return;
    setSaving(true);
    try {
      const url =
        target.kind === "order"
          ? `/api/orders/${target.orderId}`
          : `/api/orders/${target.orderId}/kalem/${target.itemId}`;

      const res = await fetch(url, {
        method: target.kind === "order" ? "PATCH" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          target.kind === "order"
            ? { status: "CANCELLED", cancelReason: reason, cancelNote: note }
            : { cancelReason: reason, cancelNote: note }
        ),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "İptal edilemedi");

      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["hesaplar"] });

      toast.success(
        target.kind === "order"
          ? "Sipariş iptal edildi"
          : json.orderCancelled
            ? "Son kalem de iptal edildi, sipariş komple iptal oldu"
            : "Kalem iptal edildi, tutar güncellendi"
      );
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "İptal edilemedi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={target !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {target?.kind === "order" ? "Siparişi İptal Et" : "Kalemi İptal Et"}
          </DialogTitle>
          <DialogDescription>
            {target?.label} · İptal nedeni kaydedilir ve yönetim raporunda görünür.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>İptal nedeni</Label>
            {CANCEL_REASONS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setReason(r.value)}
                className={cn(
                  "flex w-full flex-col items-start rounded-lg border p-3 text-left transition-colors",
                  reason === r.value ? "border-primary bg-accent/40" : "hover:bg-muted"
                )}
              >
                <span className="text-sm font-medium">{r.label}</span>
                <span className="text-xs text-muted-foreground">{r.hint}</span>
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="iptal-not">Açıklama (isteğe bağlı)</Label>
            <Input
              id="iptal-not"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Örn. müşteri masadan kalktı"
              maxLength={200}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>
              Vazgeç
            </Button>
            <Button variant="destructive" onClick={submit} disabled={saving || !reason}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "İptal Et"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
