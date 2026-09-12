"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guards";

export type ActionResult = { ok: true } | { ok: false; error: string };

/* ------------------------------------------------------------------ */
/* Kategoriler                                                         */
/* ------------------------------------------------------------------ */

const categorySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Kategori adı gerekli").max(60),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export async function saveCategory(input: unknown): Promise<ActionResult> {
  await requireUser(["ADMIN"]);
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { id, name, sortOrder } = parsed.data;

  if (id) {
    await prisma.category.update({ where: { id }, data: { name, sortOrder } });
  } else {
    await prisma.category.create({ data: { name, sortOrder } });
  }
  revalidatePath("/yonetim/menu");
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  await requireUser(["ADMIN"]);
  const count = await prisma.product.count({ where: { categoryId: id } });
  if (count > 0) {
    return { ok: false, error: `Bu kategoride ${count} ürün var. Önce ürünleri taşıyın veya silin.` };
  }
  await prisma.category.delete({ where: { id } });
  revalidatePath("/yonetim/menu");
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Urunler + opsiyonlar                                                */
/* ------------------------------------------------------------------ */

const productSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Ürün adı gerekli").max(80),
  description: z.string().max(300).optional().nullable(),
  price: z.coerce.number().min(0, "Fiyat 0'dan küçük olamaz"),
  // Hem dis bir adres (https://...) hem de yuklenip gomulen gorsel (data:image/...) kabul edilir
  imageUrl: z
    .string()
    .refine(
      (v) => v === "" || /^https?:\/\//.test(v) || /^data:image\/(jpeg|png|webp);base64,/.test(v),
      "Geçerli bir görsel adresi girin veya dosya yükleyin"
    )
    .optional()
    .nullable(),
  categoryId: z.string().min(1, "Kategori seçin"),
  isAvailable: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).default(0),
  options: z
    .array(
      z.object({
        name: z.string().min(1, "Seçenek grubu adı gerekli").max(60),
        isRequired: z.boolean().default(false),
        isMultiple: z.boolean().default(false),
        choices: z
          .array(
            z.object({
              name: z.string().min(1, "Seçenek adı gerekli").max(60),
              extraPrice: z.coerce.number().min(0).default(0),
            })
          )
          .min(1, "Her seçenek grubunda en az bir seçenek olmalı"),
      })
    )
    .default([]),
});

export type ProductInput = z.input<typeof productSchema>;

export async function saveProduct(input: unknown): Promise<ActionResult> {
  await requireUser(["ADMIN"]);
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const data = parsed.data;

  const optionsCreate = data.options.map((o, i) => ({
    name: o.name,
    isRequired: o.isRequired,
    isMultiple: o.isMultiple,
    sortOrder: i,
    choices: {
      create: o.choices.map((c, j) => ({ name: c.name, extraPrice: c.extraPrice, sortOrder: j })),
    },
  }));

  const base = {
    name: data.name,
    description: data.description?.trim() || null,
    price: data.price,
    imageUrl: data.imageUrl?.trim() || null,
    categoryId: data.categoryId,
    isAvailable: data.isAvailable,
    sortOrder: data.sortOrder,
  };

  if (data.id) {
    // Opsiyonlar tamamen yeniden yazilir; gecmis siparisler OrderItemOption'da
    // metin olarak saklandigi icin etkilenmez.
    await prisma.$transaction([
      prisma.productOption.deleteMany({ where: { productId: data.id } }),
      prisma.product.update({
        where: { id: data.id },
        data: { ...base, options: { create: optionsCreate } },
      }),
    ]);
  } else {
    await prisma.product.create({ data: { ...base, options: { create: optionsCreate } } });
  }

  revalidatePath("/yonetim/menu");
  revalidatePath("/menu", "layout");
  return { ok: true };
}

export async function toggleProductAvailability(id: string, isAvailable: boolean): Promise<ActionResult> {
  await requireUser(["ADMIN"]);
  await prisma.product.update({ where: { id }, data: { isAvailable } });
  revalidatePath("/yonetim/menu");
  revalidatePath("/menu", "layout");
  return { ok: true };
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  await requireUser(["ADMIN"]);
  const used = await prisma.orderItem.count({ where: { productId: id } });
  if (used > 0) {
    return {
      ok: false,
      error: "Bu ürün geçmiş siparişlerde kullanılıyor, silinemez. Bunun yerine 'Satışta değil' yapabilirsiniz.",
    };
  }
  await prisma.product.delete({ where: { id } });
  revalidatePath("/yonetim/menu");
  revalidatePath("/menu", "layout");
  return { ok: true };
}

/* Finans eylemleri artik src/app/yonetim/finans/actions.ts icinde. */
