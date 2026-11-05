"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guards";
import { isAcceptableMediaRef } from "@/lib/uploads";

export type ActionResult = { ok: true } | { ok: false; error: string };

/* ------------------------------------------------------------------ */
/* Kategoriler                                                         */
/* ------------------------------------------------------------------ */

const categorySchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Kategori adı gerekli").max(60),
  sortOrder: z.coerce.number().int().min(0).default(0),
  description: z.string().trim().max(200).optional().nullable(),
  imageUrl: z
    .string()
    .refine(isAcceptableMediaRef, "Geçerli bir görsel adresi girin veya dosya yükleyin")
    .optional()
    .nullable(),
  /** Bos/"none" = ust kategori */
  parentId: z.string().optional().nullable(),
});

export async function saveCategory(input: unknown): Promise<ActionResult> {
  await requireUser(["ADMIN"]);
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { id, name, sortOrder, description, imageUrl } = parsed.data;
  const parentId = parsed.data.parentId && parsed.data.parentId !== "none" ? parsed.data.parentId : null;

  // Tek seviye alt kategori: ust kategori kendisi bir alt kategori olamaz,
  // alt kategorisi olan bir kategori de baska birinin altina tasinamaz.
  if (parentId) {
    if (parentId === id) return { ok: false, error: "Kategori kendi altına alınamaz." };
    const parent = await prisma.category.findUnique({ where: { id: parentId }, select: { parentId: true } });
    if (!parent) return { ok: false, error: "Üst kategori bulunamadı." };
    if (parent.parentId) return { ok: false, error: "Alt kategorinin altına kategori eklenemez (tek seviye)." };
    if (id) {
      const childCount = await prisma.category.count({ where: { parentId: id } });
      if (childCount > 0) {
        return { ok: false, error: "Bu kategorinin alt kategorileri var; başka bir kategorinin altına taşınamaz." };
      }
    }
  }

  const data = {
    name,
    sortOrder,
    description: description || null,
    imageUrl: imageUrl?.trim() || null,
    parentId,
  };
  if (id) {
    await prisma.category.update({ where: { id }, data });
  } else {
    await prisma.category.create({ data });
  }
  revalidatePath("/yonetim/menu");
  revalidatePath("/menu", "layout");
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  await requireUser(["ADMIN"]);
  const [count, childCount] = await Promise.all([
    prisma.product.count({ where: { categoryId: id } }),
    prisma.category.count({ where: { parentId: id } }),
  ]);
  if (count > 0) {
    return { ok: false, error: `Bu kategoride ${count} ürün var. Önce ürünleri taşıyın veya silin.` };
  }
  if (childCount > 0) {
    return { ok: false, error: `Bu kategorinin ${childCount} alt kategorisi var. Önce onları silin veya taşıyın.` };
  }
  await prisma.category.delete({ where: { id } });
  revalidatePath("/yonetim/menu");
  revalidatePath("/menu", "layout");
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
  // Yuklenen dosya (/uploads/...), dis adres (https://...) ya da eski gomulu gorsel (data:image/...)
  imageUrl: z
    .string()
    .refine(isAcceptableMediaRef, "Geçerli bir görsel adresi girin veya dosya yükleyin")
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
