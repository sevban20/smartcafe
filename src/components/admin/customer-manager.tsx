"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookUser, Loader2, Pencil, Phone, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteCustomer, saveCustomer } from "@/app/yonetim/cari/actions";
import { formatDate, formatPrice } from "@/lib/utils";
import { toast } from "sonner";

export type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  creditLimit: number | null;
  isActive: boolean;
  balance: number;
  totalSales: number;
  lastActivity: string | null;
};

type Draft = {
  id?: string;
  name: string;
  phone: string;
  notes: string;
  creditLimit: string;
  isActive: boolean;
};

const emptyDraft: Draft = { name: "", phone: "", notes: "", creditLimit: "", isActive: true };

export function CustomerManager({ customers }: { customers: CustomerRow[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<Draft>(emptyDraft);
  const [saving, setSaving] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [onlyDebtors, setOnlyDebtors] = React.useState(false);

  const totalReceivable = customers.reduce((sum, c) => sum + Math.max(0, c.balance), 0);
  const debtorCount = customers.filter((c) => c.balance > 0.001).length;

  const q = query.trim().toLocaleLowerCase("tr");
  const visible = customers.filter(
    (c) =>
      (!onlyDebtors || c.balance > 0.001) &&
      (!q || c.name.toLocaleLowerCase("tr").includes(q) || (c.phone ?? "").includes(q))
  );

  const submit = async () => {
    setSaving(true);
    const res = await saveCustomer(draft);
    setSaving(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(draft.id ? "Müşteri güncellendi" : "Müşteri eklendi");
    setOpen(false);
    router.refresh();
  };

  const remove = async (row: CustomerRow) => {
    if (!window.confirm(`"${row.name}" silinsin mi?`)) return;
    const res = await deleteCustomer(row.id);
    if (!res.ok) return toast.error(res.error);
    toast.success("Müşteri silindi");
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Cari Müşteriler</h1>
          <p className="text-sm text-muted-foreground">
            Veresiye çalışan müşteriler · {debtorCount} borçlu · toplam alacak{" "}
            <span className="font-semibold text-rose-700">{formatPrice(totalReceivable)}</span>
          </p>
        </div>
        <Button
          onClick={() => {
            setDraft(emptyDraft);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Müşteri Ekle
        </Button>
      </div>

      {customers.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="İsim ya da telefon ara"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={onlyDebtors} onCheckedChange={setOnlyDebtors} />
            Yalnızca borçlular
          </label>
        </div>
      )}

      {customers.length === 0 ? (
        <Card className="p-8 text-center">
          <BookUser className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Henüz cari müşteri yok. Sonradan ödeme yapan düzenli müşterilerini ekle; masa hesabını
            kapatırken &ldquo;Cariye Yaz&rdquo; ile borçlarına işleyebilirsin.
          </p>
        </Card>
      ) : visible.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">Eşleşen müşteri yok.</Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((c) => {
            const nearLimit = c.creditLimit != null && c.creditLimit > 0 && c.balance >= c.creditLimit * 0.9;
            return (
              <Card key={c.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/yonetim/cari/${c.id}`} className="font-semibold underline-offset-4 hover:underline">
                        {c.name}
                      </Link>
                      {!c.isActive && (
                        <Badge variant="secondary" className="text-[10px]">
                          Pasif
                        </Badge>
                      )}
                      {nearLimit && (
                        <Badge variant="outline" className="border-rose-200 bg-rose-100 text-[10px] text-rose-800">
                          Limite yakın
                        </Badge>
                      )}
                    </div>
                    {c.phone && (
                      <a
                        href={`tel:${c.phone}`}
                        className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <Phone className="h-3 w-3" />
                        {c.phone}
                      </a>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Düzenle"
                      onClick={() => {
                        setDraft({
                          id: c.id,
                          name: c.name,
                          phone: c.phone ?? "",
                          notes: c.notes ?? "",
                          creditLimit: c.creditLimit != null ? String(c.creditLimit) : "",
                          isActive: c.isActive,
                        });
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="Sil" onClick={() => remove(c)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                <div className="mt-3 flex items-end justify-between border-t pt-3">
                  <div>
                    <p className="text-[11px] text-muted-foreground">Güncel borç</p>
                    <p
                      className={`text-xl font-bold tabular-nums ${
                        c.balance > 0.001 ? "text-rose-700" : "text-emerald-700"
                      }`}
                    >
                      {formatPrice(c.balance)}
                    </p>
                    {c.creditLimit != null && (
                      <p className="text-[11px] text-muted-foreground">Limit {formatPrice(c.creditLimit)}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-muted-foreground">Toplam cari</p>
                    <p className="text-sm font-medium tabular-nums">{formatPrice(c.totalSales)}</p>
                    {c.lastActivity && (
                      <p className="text-[11px] text-muted-foreground">Son: {formatDate(c.lastActivity)}</p>
                    )}
                  </div>
                </div>

                <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                  <Link href={`/yonetim/cari/${c.id}`}>Hesap Ekstresi / Tahsilat</Link>
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Müşteriyi Düzenle" : "Yeni Cari Müşteri"}</DialogTitle>
            <DialogDescription>Alışveriş yapıp ödemeyi sonra yapan düzenli müşteriler.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cari-ad">Ad soyad / firma</Label>
              <Input
                id="cari-ad"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="Örn. Ahmet Yılmaz"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cari-tel">Telefon</Label>
                <Input
                  id="cari-tel"
                  type="tel"
                  inputMode="tel"
                  value={draft.phone}
                  onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cari-limit">Borç limiti (₺)</Label>
                <Input
                  id="cari-limit"
                  type="number"
                  min="0"
                  step="1"
                  inputMode="decimal"
                  placeholder="Limitsiz"
                  value={draft.creditLimit}
                  onChange={(e) => setDraft((d) => ({ ...d, creditLimit: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cari-not">Not</Label>
              <Textarea
                id="cari-not"
                value={draft.notes}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                placeholder="Örn. ay sonu öder, karşıdaki ofis"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Aktif</p>
                <p className="text-xs text-muted-foreground">Pasif müşterilere yeni borç yazılamaz.</p>
              </div>
              <Switch checked={draft.isActive} onCheckedChange={(v) => setDraft((d) => ({ ...d, isActive: v }))} />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Vazgeç
              </Button>
              <Button onClick={submit} disabled={saving || !draft.name.trim()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kaydet"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
