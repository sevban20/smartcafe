"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Phone, Plus, Trash2, Truck } from "lucide-react";
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
import { deleteSupplier, saveSupplier } from "@/app/yonetim/finans/actions";
import { formatPrice } from "@/lib/utils";
import { toast } from "sonner";

export type SupplierRow = {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  notes: string | null;
  isActive: boolean;
  balance: number;
  totalSpent: number;
  openCount: number;
};

type Draft = {
  id?: string;
  name: string;
  contactName: string;
  phone: string;
  notes: string;
  isActive: boolean;
};

const emptyDraft: Draft = { name: "", contactName: "", phone: "", notes: "", isActive: true };

export function SupplierManager({ suppliers }: { suppliers: SupplierRow[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<Draft>(emptyDraft);
  const [saving, setSaving] = React.useState(false);

  const totalDebt = suppliers.reduce((sum, s) => sum + s.balance, 0);

  const submit = async () => {
    setSaving(true);
    const res = await saveSupplier(draft);
    setSaving(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(draft.id ? "Tedarikçi güncellendi" : "Tedarikçi eklendi");
    setOpen(false);
    router.refresh();
  };

  const remove = async (row: SupplierRow) => {
    if (!window.confirm(`"${row.name}" silinsin mi?`)) return;
    const res = await deleteSupplier(row.id);
    if (!res.ok) return toast.error(res.error);
    toast.success("Tedarikçi silindi");
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {suppliers.length} tedarikçi · toplam borç{" "}
            <span className="font-semibold text-rose-700">{formatPrice(totalDebt)}</span>
          </p>
        </div>
        <Button
          onClick={() => {
            setDraft(emptyDraft);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Tedarikçi Ekle
        </Button>
      </div>

      {suppliers.length === 0 ? (
        <Card className="p-8 text-center">
          <Truck className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Henüz tedarikçi yok. Düzenli çalıştığın toptancıları ekle, gider girerken seçebilirsin.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {suppliers.map((s) => (
            <Card key={s.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/yonetim/finans/tedarikciler/${s.id}`}
                      className="font-semibold underline-offset-4 hover:underline"
                    >
                      {s.name}
                    </Link>
                    {!s.isActive && (
                      <Badge variant="secondary" className="text-[10px]">
                        Pasif
                      </Badge>
                    )}
                  </div>
                  {s.contactName && <p className="text-xs text-muted-foreground">{s.contactName}</p>}
                  {s.phone && (
                    <a
                      href={`tel:${s.phone}`}
                      className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Phone className="h-3 w-3" />
                      {s.phone}
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
                        id: s.id,
                        name: s.name,
                        contactName: s.contactName ?? "",
                        phone: s.phone ?? "",
                        notes: s.notes ?? "",
                        isActive: s.isActive,
                      });
                      setOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Sil" onClick={() => remove(s)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>

              <div className="mt-3 flex items-end justify-between border-t pt-3">
                <div>
                  <p className="text-[11px] text-muted-foreground">Güncel borç</p>
                  <p
                    className={`text-xl font-bold tabular-nums ${
                      s.balance > 0 ? "text-rose-700" : "text-emerald-700"
                    }`}
                  >
                    {formatPrice(s.balance)}
                  </p>
                  {s.openCount > 0 && (
                    <p className="text-[11px] text-muted-foreground">{s.openCount} açık kalem</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-muted-foreground">Toplam alım</p>
                  <p className="text-sm font-medium tabular-nums">{formatPrice(s.totalSpent)}</p>
                </div>
              </div>

              <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                <Link href={`/yonetim/finans/tedarikciler/${s.id}`}>Cari Hesabı Aç</Link>
              </Button>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Tedarikçiyi Düzenle" : "Yeni Tedarikçi"}</DialogTitle>
            <DialogDescription>Düzenli mal aldığın toptancıları buraya kaydet.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ted-ad">Firma adı</Label>
              <Input
                id="ted-ad"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="Örn. A Toptan Gıda"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ted-kisi">Yetkili kişi</Label>
                <Input
                  id="ted-kisi"
                  value={draft.contactName}
                  onChange={(e) => setDraft((d) => ({ ...d, contactName: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ted-tel">Telefon</Label>
                <Input
                  id="ted-tel"
                  type="tel"
                  inputMode="tel"
                  value={draft.phone}
                  onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ted-not">Not</Label>
              <Textarea
                id="ted-not"
                value={draft.notes}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                placeholder="Örn. salı ve cuma teslimat, 15 gün vade"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Aktif</p>
                <p className="text-xs text-muted-foreground">Pasif tedarikçiler gider formunda görünmez.</p>
              </div>
              <Switch
                checked={draft.isActive}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, isActive: v }))}
              />
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
