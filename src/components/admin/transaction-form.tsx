"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { saveTransaction } from "@/app/yonetim/finans/actions";
import { toast } from "sonner";

export type TransactionFormValues = {
  id?: string;
  type: "INCOME" | "EXPENSE";
  amount: string;
  description: string;
  category: string;
  documentNo: string;
  supplierId: string;
  date: string;
  isPaid: boolean;
  dueDate: string;
};

export function emptyTransaction(type: "INCOME" | "EXPENSE" = "EXPENSE"): TransactionFormValues {
  return {
    type,
    amount: "",
    description: "",
    category: "",
    documentNo: "",
    supplierId: "none",
    date: new Date().toISOString().slice(0, 10),
    isPaid: true,
    dueDate: "",
  };
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  initial?: TransactionFormValues | null;
};

export function TransactionForm({ open, onOpenChange, categories, suppliers, initial }: Props) {
  const router = useRouter();
  const [form, setForm] = React.useState<TransactionFormValues>(initial ?? emptyTransaction());
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) setForm(initial ?? emptyTransaction());
  }, [open, initial]);

  const set = <K extends keyof TransactionFormValues>(key: K, value: TransactionFormValues[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const isExpense = form.type === "EXPENSE";

  const submit = async () => {
    setSaving(true);
    const res = await saveTransaction({
      ...form,
      amount: Number(form.amount),
      supplierId: form.supplierId === "none" ? null : form.supplierId,
      dueDate: form.isPaid ? null : form.dueDate || null,
      isPaid: isExpense ? form.isPaid : true,
    });
    setSaving(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(form.id ? "Kayıt güncellendi" : isExpense ? "Gider eklendi" : "Gelir eklendi");
    onOpenChange(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{form.id ? "Kaydı Düzenle" : "Yeni Kayıt"}</DialogTitle>
          <DialogDescription>
            Toptancı ödemeleri, kira, fatura gibi giderleri ve manuel gelirleri buradan girin.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {!form.id && (
            <Tabs value={form.type} onValueChange={(v) => set("type", v as "INCOME" | "EXPENSE")}>
              <TabsList className="w-full">
                <TabsTrigger value="EXPENSE" className="flex-1">
                  Gider
                </TabsTrigger>
                <TabsTrigger value="INCOME" className="flex-1">
                  Gelir
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tutar">Tutar (₺)</Label>
              <Input
                id="tutar"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
                placeholder="0,00"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tarih">Tarih</Label>
              <Input id="tarih" type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="aciklama">Açıklama</Label>
            <Input
              id="aciklama"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder={isExpense ? "Örn. Süt ve kahve çekirdeği alımı" : "Örn. Ekipman satışı"}
            />
          </div>

          {isExpense && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Gider kalemi</Label>
                  <Select value={form.category || "none"} onValueChange={(v) => set("category", v === "none" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Kalem yok</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.name}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Tedarikçi</Label>
                  <Select value={form.supplierId} onValueChange={(v) => set("supplierId", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Tedarikçi yok</SelectItem>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="belge">Fatura / irsaliye no (isteğe bağlı)</Label>
                <Input
                  id="belge"
                  value={form.documentNo}
                  onChange={(e) => set("documentNo", e.target.value)}
                  placeholder="Örn. A-2026-0142"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">{form.isPaid ? "Peşin ödendi" : "Veresiye (borç)"}</p>
                  <p className="text-xs text-muted-foreground">
                    {form.isPaid
                      ? "Tutar hemen ödenmiş sayılır."
                      : "Tedarikçi cari hesabına borç olarak işlenir."}
                  </p>
                </div>
                <Switch checked={form.isPaid} onCheckedChange={(v) => set("isPaid", v)} />
              </div>

              {!form.isPaid && (
                <div className="space-y-1.5">
                  <Label htmlFor="vade">Vade tarihi (isteğe bağlı)</Label>
                  <Input
                    id="vade"
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => set("dueDate", e.target.value)}
                  />
                </div>
              )}
            </>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Vazgeç
            </Button>
            <Button onClick={submit} disabled={saving || !form.amount || !form.description.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kaydet"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
