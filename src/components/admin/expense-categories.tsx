"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Tag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteExpenseCategory, saveExpenseCategory } from "@/app/yonetim/finans/actions";
import { formatPrice } from "@/lib/utils";
import { toast } from "sonner";

export type ExpenseCategoryRow = {
  id: string;
  name: string;
  sortOrder: number;
  usageCount: number;
  total: number;
};

export function ExpenseCategories({ categories }: { categories: ExpenseCategoryRow[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<{ id?: string; name: string; sortOrder: number }>({
    name: "",
    sortOrder: 0,
  });
  const [saving, setSaving] = React.useState(false);

  const submit = async () => {
    setSaving(true);
    const res = await saveExpenseCategory(draft);
    setSaving(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(draft.id ? "Kalem güncellendi" : "Kalem eklendi");
    setOpen(false);
    router.refresh();
  };

  const remove = async (row: ExpenseCategoryRow) => {
    if (!window.confirm(`"${row.name}" kalemi silinsin mi?`)) return;
    const res = await deleteExpenseCategory(row.id);
    if (!res.ok) return toast.error(res.error);
    toast.success("Kalem silindi");
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Gider girerken seçeceğin kalemler. Kendi işine göre ekleyip düzenleyebilirsin.
        </p>
        <Button
          onClick={() => {
            setDraft({ name: "", sortOrder: categories.length });
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Kalem Ekle
        </Button>
      </div>

      {categories.length === 0 ? (
        <Card className="p-8 text-center">
          <Tag className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Henüz gider kalemi yok. Örn. Hammadde, Kira, Personel, Fatura.
          </p>
        </Card>
      ) : (
        <Card className="divide-y">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  {c.usageCount} kayıt · toplam {formatPrice(c.total)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Düzenle"
                onClick={() => {
                  setDraft({ id: c.id, name: c.name, sortOrder: c.sortOrder });
                  setOpen(true);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Sil" onClick={() => remove(c)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Kalemi Düzenle" : "Yeni Gider Kalemi"}</DialogTitle>
            <DialogDescription>Örn. Hammadde, Kira, Personel, Ekipman, Pazarlama.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="kalem-ad">Kalem adı</Label>
              <Input
                id="kalem-ad"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="Örn. Süt ve süt ürünleri"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kalem-sira">Sıra</Label>
              <Input
                id="kalem-sira"
                type="number"
                min="0"
                value={draft.sortOrder}
                onChange={(e) => setDraft((d) => ({ ...d, sortOrder: Number(e.target.value) }))}
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
