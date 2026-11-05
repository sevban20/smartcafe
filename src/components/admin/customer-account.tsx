"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, HandCoins, Loader2, Phone, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { addCustomerEntry, deleteCustomerEntry } from "@/app/yonetim/cari/actions";
import { PAYMENT_METHODS } from "@/lib/constants";
import { formatDate, formatPrice, formatTime } from "@/lib/utils";
import { toast } from "sonner";

export type LedgerRow = {
  id: string;
  kind: "SATIS" | "TAHSILAT" | "BORC";
  date: string;
  title: string;
  detail: string;
  amount: number;
  balanceAfter: number;
};

export type CustomerAccountData = {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  creditLimit: number | null;
  isActive: boolean;
  balance: number;
  sales: number;
  manualDebt: number;
  collected: number;
  ledger: LedgerRow[];
};

type EntryMode = "TAHSILAT" | "BORC" | null;

export function CustomerAccount({ customer }: { customer: CustomerAccountData }) {
  const router = useRouter();
  const [mode, setMode] = React.useState<EntryMode>(null);
  const [amount, setAmount] = React.useState("");
  const [method, setMethod] = React.useState<string>(PAYMENT_METHODS[0]);
  const [date, setDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const openDialog = (m: Exclude<EntryMode, null>) => {
    setMode(m);
    setAmount(m === "TAHSILAT" && customer.balance > 0 ? String(customer.balance) : "");
    setMethod(PAYMENT_METHODS[0]);
    setDate(new Date().toISOString().slice(0, 10));
    setNote("");
  };

  const submit = async () => {
    if (!mode) return;
    setSaving(true);
    const res = await addCustomerEntry({
      customerId: customer.id,
      type: mode,
      amount: Number(amount),
      method,
      note,
      date,
    });
    setSaving(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(mode === "TAHSILAT" ? "Tahsilat kaydedildi" : "Borç eklendi");
    setMode(null);
    router.refresh();
  };

  const removeEntry = async (row: LedgerRow) => {
    if (!window.confirm(`${row.title} (${formatPrice(row.amount)}) silinsin mi?`)) return;
    const res = await deleteCustomerEntry(row.id);
    if (!res.ok) return toast.error(res.error);
    toast.success("Kayıt silindi");
    router.refresh();
  };

  const overLimit = customer.creditLimit != null && customer.balance > customer.creditLimit + 0.001;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Button asChild variant="ghost" size="icon" aria-label="Geri">
            <Link href="/yonetim/cari">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold leading-tight">{customer.name}</h1>
              {!customer.isActive && (
                <Badge variant="secondary" className="text-[10px]">
                  Pasif
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {customer.phone ? (
                <a href={`tel:${customer.phone}`} className="inline-flex items-center gap-1 hover:text-foreground">
                  <Phone className="h-3 w-3" />
                  {customer.phone}
                </a>
              ) : (
                "Telefon kayıtlı değil"
              )}
              {customer.creditLimit != null ? ` · limit ${formatPrice(customer.creditLimit)}` : " · limitsiz"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => openDialog("BORC")}>
            <Plus className="h-4 w-4" />
            Borç Ekle
          </Button>
          <Button onClick={() => openDialog("TAHSILAT")} disabled={customer.balance <= 0.001}>
            <HandCoins className="h-4 w-4" />
            Tahsilat Al
          </Button>
        </div>
      </div>

      {customer.notes && (
        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{customer.notes}</p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Card className={`col-span-2 p-4 lg:col-span-1 ${overLimit ? "border-rose-200 bg-rose-50/50" : ""}`}>
          <p className="text-xs font-medium text-muted-foreground">Güncel borç</p>
          <p
            className={`mt-1 text-2xl font-bold tabular-nums ${
              customer.balance > 0.001 ? "text-rose-700" : "text-emerald-700"
            }`}
          >
            {formatPrice(customer.balance)}
          </p>
          {overLimit && <p className="text-xs text-rose-700">Limit aşıldı</p>}
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Cariye yazılan</p>
          <p className="mt-1 text-lg font-bold tabular-nums">{formatPrice(customer.sales + customer.manualDebt)}</p>
          {customer.manualDebt > 0 && (
            <p className="text-[11px] text-muted-foreground">{formatPrice(customer.manualDebt)} elle borç</p>
          )}
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Tahsil edilen</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-emerald-700">{formatPrice(customer.collected)}</p>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Hesap ekstresi</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {customer.ledger.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Henüz hareket yok. Masa hesabını kapatırken &ldquo;Cariye Yaz&rdquo; seçildiğinde burada görünür.
            </p>
          ) : (
            <ul className="divide-y">
              {customer.ledger.map((row) => {
                const isCredit = row.kind === "TAHSILAT";
                return (
                  <li key={`${row.kind}-${row.id}`} className="flex items-start gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{row.title}</p>
                        {row.kind === "BORC" && (
                          <Badge variant="outline" className="border-amber-200 bg-amber-100 text-[10px] text-amber-800">
                            Elle
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(row.date)} {formatTime(row.date)}
                      </p>
                      {row.detail && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{row.detail}</p>}
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className={`text-sm font-semibold tabular-nums ${
                          isCredit ? "text-emerald-700" : "text-rose-700"
                        }`}
                      >
                        {isCredit ? "−" : "+"}
                        {formatPrice(row.amount)}
                      </p>
                      <p className="text-[11px] text-muted-foreground tabular-nums">
                        Bakiye {formatPrice(row.balanceAfter)}
                      </p>
                    </div>
                    {row.kind !== "SATIS" ? (
                      <Button variant="ghost" size="icon" aria-label="Sil" onClick={() => removeEntry(row)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    ) : (
                      <span className="w-10 shrink-0" />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={mode !== null} onOpenChange={(v) => !v && setMode(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{mode === "TAHSILAT" ? "Tahsilat Al" : "Elle Borç Ekle"}</DialogTitle>
            <DialogDescription>
              {mode === "TAHSILAT"
                ? `${customer.name} · güncel borç ${formatPrice(customer.balance)}. Satış zaten ciroya yazıldı; tahsilat yalnızca borçtan düşer.`
                : "Sisteme geçmeden önceki devir borcu gibi kayıtlar için. Ciroya yazılmaz."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cari-tutar">Tutar (₺)</Label>
              <Input
                id="cari-tutar"
                type="number"
                step="0.01"
                min="0"
                max={mode === "TAHSILAT" ? customer.balance : undefined}
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {mode === "TAHSILAT" && (
                <p className="text-[11px] text-muted-foreground">
                  Kısmi ödeme alabilirsin; kalan borç hesapta durmaya devam eder.
                </p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {mode === "TAHSILAT" && (
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
              )}
              <div className="space-y-1.5">
                <Label htmlFor="cari-tarih">Tarih</Label>
                <Input id="cari-tarih" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cari-aciklama">{mode === "BORC" ? "Açıklama" : "Not (isteğe bağlı)"}</Label>
              <Input
                id="cari-aciklama"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={mode === "BORC" ? "Örn. Ekim ayı devri" : "Örn. havale, dekont no"}
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setMode(null)}>
                Vazgeç
              </Button>
              <Button
                onClick={submit}
                disabled={saving || !amount || Number(amount) <= 0 || (mode === "BORC" && !note.trim())}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kaydet"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
