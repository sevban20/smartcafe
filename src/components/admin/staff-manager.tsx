"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Pencil, Plus, ShieldCheck, Trash2, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteUser, saveUser } from "@/app/yonetim/personel/actions";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

export type StaffRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: "ADMIN" | "STAFF";
  isActive: boolean;
  createdAt: string;
  orderCount: number;
};

type Draft = {
  id?: string;
  name: string;
  email: string;
  phone: string;
  role: "ADMIN" | "STAFF";
  isActive: boolean;
  password: string;
};

const emptyDraft: Draft = {
  name: "",
  email: "",
  phone: "",
  role: "STAFF",
  isActive: true,
  password: "",
};

export function StaffManager({ users, currentUserId }: { users: StaffRow[]; currentUserId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<Draft>(emptyDraft);
  const [saving, setSaving] = React.useState(false);

  const submit = async () => {
    setSaving(true);
    const res = await saveUser(draft);
    setSaving(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(draft.id ? "Kullanıcı güncellendi" : "Kullanıcı eklendi");
    setOpen(false);
    router.refresh();
  };

  const remove = async (row: StaffRow) => {
    if (!window.confirm(`"${row.name}" silinsin mi?`)) return;
    const res = await deleteUser(row.id);
    if (!res.ok) return toast.error(res.error);
    toast.success("Kullanıcı silindi");
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Personel</h1>
          <p className="text-sm text-muted-foreground">
            Garson hesapları sipariş ve hesap ekranlarını görür; ciro, gider ve kâr–zarar
            ekranlarına erişemez.
          </p>
        </div>
        <Button
          onClick={() => {
            setDraft(emptyDraft);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Personel Ekle
        </Button>
      </div>

      <Card className="divide-y">
        {users.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center gap-3 p-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                u.role === "ADMIN" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {u.role === "ADMIN" ? <ShieldCheck className="h-5 w-5" /> : <UserIcon className="h-5 w-5" />}
            </div>

            <div className="min-w-[10rem] flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">{u.name}</p>
                <Badge variant={u.role === "ADMIN" ? "default" : "secondary"} className="text-[10px]">
                  {u.role === "ADMIN" ? "Yönetici" : "Garson"}
                </Badge>
                {!u.isActive && (
                  <Badge variant="outline" className="border-rose-200 bg-rose-100 text-[10px] text-rose-800">
                    Pasif
                  </Badge>
                )}
                {u.id === currentUserId && (
                  <span className="text-[11px] text-muted-foreground">(siz)</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {u.email}
                {u.phone ? ` · ${u.phone}` : ""} · {u.orderCount} sipariş · {formatDate(u.createdAt)}
              </p>
            </div>

            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Düzenle"
                onClick={() => {
                  setDraft({
                    id: u.id,
                    name: u.name,
                    email: u.email,
                    phone: u.phone ?? "",
                    role: u.role,
                    isActive: u.isActive,
                    password: "",
                  });
                  setOpen(true);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Sil" onClick={() => remove(u)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </Card>

      <Card className="p-4">
        <p className="text-sm font-medium">Garson hesabı neyi görür?</p>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          <li>✓ Sipariş ekranı (KDS) — hazırla / teslim et / iptal</li>
          <li>✓ Masa adına sipariş girme</li>
          <li>✓ Açık hesaplar — hesap kapatma, ödeme yöntemi seçme</li>
          <li>✗ Ciro, kâr–zarar, gider ve tedarikçi ekranları</li>
          <li>✗ Menü ve fiyat düzenleme, QR üretme, personel yönetimi</li>
        </ul>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Personeli Düzenle" : "Yeni Personel"}</DialogTitle>
            <DialogDescription>
              {draft.id
                ? "Şifre alanını boş bırakırsan mevcut şifre değişmez."
                : "Personel bu e-posta ve şifreyle giriş yapacak."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Tabs value={draft.role} onValueChange={(v) => setDraft((d) => ({ ...d, role: v as "ADMIN" | "STAFF" }))}>
              <TabsList className="w-full">
                <TabsTrigger value="STAFF" className="flex-1">
                  Garson
                </TabsTrigger>
                <TabsTrigger value="ADMIN" className="flex-1">
                  Yönetici
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="space-y-1.5">
              <Label htmlFor="p-ad">Ad soyad</Label>
              <Input
                id="p-ad"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="Örn. Ahmet Yılmaz"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="p-mail">E-posta</Label>
              <Input
                id="p-mail"
                type="email"
                inputMode="email"
                value={draft.email}
                onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                placeholder="ahmet@kafem.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="p-tel">Telefon (isteğe bağlı)</Label>
              <Input
                id="p-tel"
                type="tel"
                inputMode="tel"
                value={draft.phone}
                onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="p-sifre" className="flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5" />
                {draft.id ? "Yeni şifre (boş = değişmesin)" : "Şifre"}
              </Label>
              <Input
                id="p-sifre"
                type="text"
                autoComplete="new-password"
                value={draft.password}
                onChange={(e) => setDraft((d) => ({ ...d, password: e.target.value }))}
                placeholder="En az 6 karakter"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Aktif</p>
                <p className="text-xs text-muted-foreground">Pasif hesap giriş yapamaz.</p>
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
              <Button onClick={submit} disabled={saving || !draft.name.trim() || !draft.email.trim()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kaydet"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
