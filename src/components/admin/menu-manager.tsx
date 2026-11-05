"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Coffee, CornerDownRight, FolderPlus, Loader2, Palette, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImagePicker } from "@/components/admin/image-picker";
import { ProductForm, type ProductFormValues } from "@/components/admin/product-form";
import { deleteCategory, deleteProduct, saveCategory, toggleProductAvailability } from "@/app/yonetim/actions";
import { formatPrice } from "@/lib/utils";
import { toast } from "sonner";

export type AdminCategory = {
  id: string;
  name: string;
  sortOrder: number;
  description: string | null;
  imageUrl: string | null;
  parentId: string | null;
  products: {
    id: string;
    name: string;
    description: string | null;
    price: number;
    imageUrl: string | null;
    isAvailable: boolean;
    sortOrder: number;
    options: {
      name: string;
      isRequired: boolean;
      isMultiple: boolean;
      choices: { name: string; extraPrice: number }[];
    }[];
  }[];
};

type CategoryDraft = {
  id?: string;
  name: string;
  sortOrder: number;
  description: string;
  imageUrl: string;
  parentId: string;
};

const emptyCategoryDraft = (sortOrder: number, parentId = "none"): CategoryDraft => ({
  name: "",
  sortOrder,
  description: "",
  imageUrl: "",
  parentId,
});

export function MenuManager({ categories }: { categories: AdminCategory[] }) {
  const router = useRouter();
  const [productOpen, setProductOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ProductFormValues | null>(null);
  const [categoryOpen, setCategoryOpen] = React.useState(false);
  const [categoryDraft, setCategoryDraft] = React.useState<CategoryDraft>(emptyCategoryDraft(0));
  const [busy, setBusy] = React.useState(false);

  const byId = new Map(categories.map((c) => [c.id, c]));
  // Urun formunda alt kategoriler "Kahveler › Sicak Kahveler" olarak gorunur
  const flatCategories = categories.map((c) => ({
    id: c.id,
    name: c.parentId && byId.get(c.parentId) ? `${byId.get(c.parentId)!.name} › ${c.name}` : c.name,
  }));
  const topCategories = categories.filter((c) => !c.parentId);
  const hasChildren = (id: string) => categories.some((c) => c.parentId === id);

  const openNewProduct = () => {
    setEditing({
      name: "",
      description: "",
      price: "",
      imageUrl: "",
      categoryId: flatCategories[0]?.id ?? "",
      isAvailable: true,
      sortOrder: 0,
      options: [],
    });
    setProductOpen(true);
  };

  const openEditProduct = (categoryId: string, product: AdminCategory["products"][number]) => {
    setEditing({
      id: product.id,
      name: product.name,
      description: product.description ?? "",
      price: product.price,
      imageUrl: product.imageUrl ?? "",
      categoryId,
      isAvailable: product.isAvailable,
      sortOrder: product.sortOrder,
      options: product.options.map((o) => ({
        name: o.name,
        isRequired: o.isRequired,
        isMultiple: o.isMultiple,
        choices: o.choices.map((c) => ({ name: c.name, extraPrice: c.extraPrice })),
      })),
    });
    setProductOpen(true);
  };

  const submitCategory = async () => {
    setBusy(true);
    const res = await saveCategory(categoryDraft);
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(categoryDraft.id ? "Kategori güncellendi" : "Kategori eklendi");
    setCategoryOpen(false);
    router.refresh();
  };

  const removeCategory = async (id: string, name: string) => {
    if (!window.confirm(`"${name}" kategorisi silinsin mi?`)) return;
    const res = await deleteCategory(id);
    if (!res.ok) return toast.error(res.error);
    toast.success("Kategori silindi");
    router.refresh();
  };

  const removeProduct = async (id: string, name: string) => {
    if (!window.confirm(`"${name}" ürünü silinsin mi?`)) return;
    const res = await deleteProduct(id);
    if (!res.ok) return toast.error(res.error);
    toast.success("Ürün silindi");
    router.refresh();
  };

  const toggleAvailability = async (id: string, value: boolean) => {
    await toggleProductAvailability(id, value);
    router.refresh();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Menü Yönetimi</h1>
          <p className="text-sm text-muted-foreground">Kategoriler, ürünler ve seçenek grupları</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/yonetim/menu/gorunum">
              <Palette className="h-4 w-4" />
              Görünüm
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setCategoryDraft(emptyCategoryDraft(topCategories.length));
              setCategoryOpen(true);
            }}
          >
            <FolderPlus className="h-4 w-4" />
            Kategori
          </Button>
          <Button onClick={openNewProduct} disabled={flatCategories.length === 0}>
            <Plus className="h-4 w-4" />
            Ürün
          </Button>
        </div>
      </div>

      {categories.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Önce bir kategori oluşturun, ardından ürün ekleyebilirsiniz.
          </p>
        </Card>
      ) : (
        categories.map((category) => (
          <section
            key={category.id}
            className={category.parentId ? "ml-4 space-y-2 border-l-2 border-dashed pl-3 sm:ml-6" : "space-y-2"}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                {category.parentId && <CornerDownRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                {category.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={category.imageUrl} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" />
                )}
                <div className="min-w-0">
                  <h2 className={category.parentId ? "text-sm font-semibold" : "text-base font-semibold"}>
                    {category.name}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {category.products.length} ürün
                      {category.parentId ? " · alt kategori" : ""}
                    </span>
                  </h2>
                  {category.description && (
                    <p className="line-clamp-1 text-xs text-muted-foreground">{category.description}</p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                {!category.parentId && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setCategoryDraft(
                        emptyCategoryDraft(categories.filter((c) => c.parentId === category.id).length, category.id)
                      );
                      setCategoryOpen(true);
                    }}
                    aria-label="Alt kategori ekle"
                    title="Alt kategori ekle"
                  >
                    <FolderPlus className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setCategoryDraft({
                      id: category.id,
                      name: category.name,
                      sortOrder: category.sortOrder,
                      description: category.description ?? "",
                      imageUrl: category.imageUrl ?? "",
                      parentId: category.parentId ?? "none",
                    });
                    setCategoryOpen(true);
                  }}
                  aria-label="Kategoriyi düzenle"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeCategory(category.id, category.name)}
                  aria-label="Kategoriyi sil"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {category.products.length === 0 && !hasChildren(category.id) && (
                <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                  Bu kategoride ürün yok.
                </p>
              )}
              {category.products.map((product) => (
                <Card key={product.id} className="p-3">
                  <div className="flex items-start gap-3">
                    {product.imageUrl ? (
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <Coffee className="h-5 w-5" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold leading-tight">{product.name}</p>
                        <span className="font-medium text-primary tabular-nums">{formatPrice(product.price)}</span>
                      </div>
                      {product.description && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{product.description}</p>
                      )}
                      {product.options.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {product.options.map((o) => (
                            <Badge key={o.name} variant="secondary" className="text-[10px] font-normal">
                              {o.name} ({o.choices.length})
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t pt-2.5">
                    <label className="flex items-center gap-2">
                      <Switch
                        checked={product.isAvailable}
                        onCheckedChange={(v) => toggleAvailability(product.id, v)}
                      />
                      <span className="text-xs text-muted-foreground">
                        {product.isAvailable ? "Satışta" : "Satışta değil"}
                      </span>
                    </label>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEditProduct(category.id, product)}>
                        <Pencil className="h-4 w-4" />
                        Düzenle
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => removeProduct(product.id, product.name)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        ))
      )}

      <ProductForm
        open={productOpen}
        onOpenChange={setProductOpen}
        categories={flatCategories}
        initial={editing}
      />

      <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {categoryDraft.id
                ? "Kategoriyi Düzenle"
                : categoryDraft.parentId !== "none"
                  ? "Yeni Alt Kategori"
                  : "Yeni Kategori"}
            </DialogTitle>
            <DialogDescription>
              Ana kategoriler menüde kart olarak görünür; alt kategoriler o kartın içinde başlık olur.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="kategori-adi">Kategori adı</Label>
              <Input
                id="kategori-adi"
                value={categoryDraft.name}
                onChange={(e) => setCategoryDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="Örn. Sıcak Kahveler"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_6rem]">
              <div className="space-y-1.5">
                <Label>Üst kategori</Label>
                <Select
                  value={categoryDraft.parentId}
                  onValueChange={(v) => setCategoryDraft((d) => ({ ...d, parentId: v }))}
                  disabled={!!categoryDraft.id && hasChildren(categoryDraft.id)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Yok (ana kategori)</SelectItem>
                    {topCategories
                      .filter((c) => c.id !== categoryDraft.id)
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {categoryDraft.id && hasChildren(categoryDraft.id) && (
                  <p className="text-[11px] text-muted-foreground">
                    Alt kategorileri olduğu için ana kategori olarak kalmalı.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kategori-sira">Sıra</Label>
                <Input
                  id="kategori-sira"
                  type="number"
                  min="0"
                  value={categoryDraft.sortOrder}
                  onChange={(e) => setCategoryDraft((d) => ({ ...d, sortOrder: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kategori-aciklama">Kısa açıklama (isteğe bağlı)</Label>
              <Textarea
                id="kategori-aciklama"
                rows={2}
                maxLength={200}
                value={categoryDraft.description}
                onChange={(e) => setCategoryDraft((d) => ({ ...d, description: e.target.value }))}
                placeholder="Örn. Özenle seçilmiş çekirdeklerden hazırlanan kahveler"
              />
            </div>
            <ImagePicker
              label="Kategori görseli (isteğe bağlı)"
              value={categoryDraft.imageUrl}
              onChange={(v) => setCategoryDraft((d) => ({ ...d, imageUrl: v }))}
              maxEdge={1200}
              previewClassName="aspect-[3/4] h-auto w-24"
              hint="Menüdeki kategori kartında görünür. Boş bırakılırsa ilk ürünün fotoğrafı kullanılır."
            />
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setCategoryOpen(false)}>
                Vazgeç
              </Button>
              <Button onClick={submitCategory} disabled={busy || !categoryDraft.name.trim()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kaydet"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
