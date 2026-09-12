"use client";

import * as React from "react";
import { useFieldArray, useForm, useWatch, type Control, type UseFormRegister } from "react-hook-form";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImagePicker } from "@/components/admin/image-picker";
import { saveProduct } from "@/app/yonetim/actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export type ProductFormValues = {
  id?: string;
  name: string;
  description: string;
  price: number | string;
  imageUrl: string;
  categoryId: string;
  isAvailable: boolean;
  sortOrder: number | string;
  options: {
    name: string;
    isRequired: boolean;
    isMultiple: boolean;
    choices: { name: string; extraPrice: number | string }[];
  }[];
};

const emptyValues: ProductFormValues = {
  name: "",
  description: "",
  price: "",
  imageUrl: "",
  categoryId: "",
  isAvailable: true,
  sortOrder: 0,
  options: [],
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: { id: string; name: string }[];
  initial?: ProductFormValues | null;
};

export function ProductForm({ open, onOpenChange, categories, initial }: Props) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);

  const form = useForm<ProductFormValues>({ defaultValues: initial ?? emptyValues });
  const { register, control, handleSubmit, reset, setValue, formState } = form;

  React.useEffect(() => {
    if (open) reset(initial ?? emptyValues);
  }, [open, initial, reset]);

  const optionArray = useFieldArray({ control, name: "options" });
  const categoryId = useWatch({ control, name: "categoryId" });
  const isAvailable = useWatch({ control, name: "isAvailable" });
  const imageUrl = useWatch({ control, name: "imageUrl" });

  const onSubmit = handleSubmit(async (values) => {
    setSaving(true);
    const res = await saveProduct({
      ...values,
      price: Number(values.price),
      sortOrder: Number(values.sortOrder || 0),
      options: values.options.map((o) => ({
        ...o,
        choices: o.choices.map((c) => ({ ...c, extraPrice: Number(c.extraPrice || 0) })),
      })),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(values.id ? "Ürün güncellendi" : "Ürün eklendi");
    onOpenChange(false);
    router.refresh();
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Ürünü Düzenle" : "Yeni Ürün"}</DialogTitle>
          <DialogDescription>
            Ürün bilgilerini girin ve seçenek gruplarını (boyut, süt, ekstralar) tanımlayın.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="name">Ürün adı</Label>
              <Input id="name" placeholder="Örn. Latte" {...register("name", { required: true })} />
              {formState.errors.name && <p className="text-xs text-destructive">Ürün adı gerekli.</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="price">Baz fiyat (₺)</Label>
              <Input id="price" type="number" step="0.01" min="0" inputMode="decimal" {...register("price", { required: true })} />
            </div>

            <div className="space-y-1.5">
              <Label>Kategori</Label>
              <Select value={categoryId} onValueChange={(v) => setValue("categoryId", v, { shouldDirty: true })}>
                <SelectTrigger>
                  <SelectValue placeholder="Kategori seçin" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="description">Açıklama</Label>
              <Textarea id="description" placeholder="Kısa tanım" {...register("description")} />
            </div>

            <div className="sm:col-span-2">
              <ImagePicker
                value={imageUrl ?? ""}
                onChange={(v) => setValue("imageUrl", v, { shouldDirty: true })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sortOrder">Sıra</Label>
              <Input id="sortOrder" type="number" min="0" {...register("sortOrder")} />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
              <div>
                <p className="text-sm font-medium">Satışta</p>
                <p className="text-xs text-muted-foreground">Kapalıyken müşteri menüsünde görünmez.</p>
              </div>
              <Switch
                checked={isAvailable}
                onCheckedChange={(v) => setValue("isAvailable", v, { shouldDirty: true })}
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Seçenek grupları</h3>
                <p className="text-xs text-muted-foreground">Örn. Boyut, Süt Tercihi, Ekstralar</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  optionArray.append({
                    name: "",
                    isRequired: false,
                    isMultiple: false,
                    choices: [{ name: "", extraPrice: 0 }],
                  })
                }
              >
                <Plus className="h-4 w-4" />
                Grup ekle
              </Button>
            </div>

            {optionArray.fields.length === 0 && (
              <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                Henüz seçenek grubu yok. Ürün tek fiyattan satılacak.
              </p>
            )}

            {optionArray.fields.map((field, optionIndex) => (
              <OptionGroup
                key={field.id}
                control={control}
                register={register}
                setValue={setValue}
                optionIndex={optionIndex}
                onRemove={() => optionArray.remove(optionIndex)}
              />
            ))}
          </div>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kaydet"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function OptionGroup({
  control,
  register,
  setValue,
  optionIndex,
  onRemove,
}: {
  control: Control<ProductFormValues>;
  register: UseFormRegister<ProductFormValues>;
  setValue: ReturnType<typeof useForm<ProductFormValues>>["setValue"];
  optionIndex: number;
  onRemove: () => void;
}) {
  const choiceArray = useFieldArray({ control, name: `options.${optionIndex}.choices` });
  const isRequired = useWatch({ control, name: `options.${optionIndex}.isRequired` });
  const isMultiple = useWatch({ control, name: `options.${optionIndex}.isMultiple` });

  return (
    <div className="space-y-3 rounded-xl border bg-muted/30 p-3">
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <Label>Grup adı</Label>
          <Input
            placeholder="Örn. Boyut"
            className="bg-background"
            {...register(`options.${optionIndex}.name` as const, { required: true })}
          />
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label="Grubu sil">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex items-center justify-between rounded-lg border bg-background p-2.5">
          <span className="text-xs font-medium">Zorunlu seçim</span>
          <Switch
            checked={!!isRequired}
            onCheckedChange={(v) => setValue(`options.${optionIndex}.isRequired`, v, { shouldDirty: true })}
          />
        </label>
        <label className="flex items-center justify-between rounded-lg border bg-background p-2.5">
          <span className="text-xs font-medium">Çoklu seçim</span>
          <Switch
            checked={!!isMultiple}
            onCheckedChange={(v) => setValue(`options.${optionIndex}.isMultiple`, v, { shouldDirty: true })}
          />
        </label>
      </div>

      <div className="space-y-2">
        {choiceArray.fields.map((choice, choiceIndex) => (
          <div key={choice.id} className="flex items-center gap-2">
            <Input
              placeholder="Seçenek adı (örn. Büyük)"
              className="flex-1 bg-background"
              {...register(`options.${optionIndex}.choices.${choiceIndex}.name` as const, { required: true })}
            />
            <Input
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="+₺"
              className="w-24 bg-background"
              {...register(`options.${optionIndex}.choices.${choiceIndex}.extraPrice` as const)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => choiceArray.remove(choiceIndex)}
              disabled={choiceArray.fields.length === 1}
              aria-label="Seçeneği sil"
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => choiceArray.append({ name: "", extraPrice: 0 })}
        >
          <Plus className="h-4 w-4" />
          Seçenek ekle
        </Button>
      </div>
    </div>
  );
}
