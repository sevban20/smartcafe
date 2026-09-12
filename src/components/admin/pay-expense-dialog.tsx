"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { payExpense } from "@/app/yonetim/finans/actions";
import { PAYMENT_METHODS } from "@/lib/constants";
import { formatPrice } from "@/lib/utils";
import { toast } from "sonner";

export type PayableExpense = {
  id: string;
  description: string;
  amount: number;
  paidAmount: number;
  supplierName?: string | null;
};

export function PayExpenseDialog({
  expense,
  onOpenChange,
}: {
  expense: PayableExpense | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [amount, setAmount] = React.useState("");
  const [method, setMethod] = React.useState<string>(PAYMENT_METHODS[0]);
  const [date, setDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const remaining = expense ? Math.round((expense.amount - expense.paidAmount) * 100) / 100 : 0;

  React.useEffect(() => {
    if (expense) {
      setAmount(String(remaining));
      setDate(new Date().toISOString().slice(0, 10));
      setNote("");
    }
  }, [expense, remaining]);

  const submit = async () => {
    if (!expense) return;
    setSaving(true);
    const res = await payExpense({
      transactionId: expense.id,
      amount: Number(amount),
      method,
      note,
      date,
    });
    setSaving(false);
    if (!res.ok) return toast.error(res.error);
    toast.success("Ödeme kaydedildi");
    onOpenChange(false);
    router.refresh();
  };

  return (
    <Dialog open={expense !== null} onOpenChange={(v) => !v && onOpenChange(false)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ödeme Yap</DialogTitle>
          <DialogDescription>
            {expense?.supplierName ? `${expense.supplierName} · ` : ""}
            {expense?.description}
          </DialogDescription>
        </DialogHeader>

        {expense && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 rounded-lg border p-3 text-center">
              <div>
                <p className="text-[11px] text-muted-foreground">Tutar</p>
                <p className="text-sm font-semibold tabular-nums">{formatPrice(expense.amount)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Ödenen</p>
                <p className="text-sm font-semibold tabular-nums">{formatPrice(expense.paidAmount)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Kalan</p>
                <p className="text-sm font-bold tabular-nums text-rose-700">{formatPrice(remaining)}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="odeme-tutar">Ödenecek tutar (₺)</Label>
              <Input
                id="odeme-tutar"
                type="number"
                step="0.01"
                min="0"
                max={remaining}
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Kısmi ödeme yapabilirsin; kalan borç cari hesapta durmaya devam eder.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Ödeme yöntemi</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="odeme-tarih">Tarih</Label>
                <Input id="odeme-tarih" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="odeme-not">Not (isteğe bağlı)</Label>
              <Input id="odeme-not" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Örn. dekont no" />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Vazgeç
              </Button>
              <Button onClick={submit} disabled={saving || !amount || Number(amount) <= 0}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ödemeyi Kaydet"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
