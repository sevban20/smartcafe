"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guards";
import type { ActionResult } from "@/app/yonetim/actions";
import type { Prisma } from "@prisma/client";

const FINANCE_PATHS = ["/yonetim", "/yonetim/finans", "/yonetim/finans/tedarikciler", "/yonetim/finans/kalemler"];

function revalidateFinance() {
  for (const path of FINANCE_PATHS) revalidatePath(path);
}

/* ------------------------------------------------------------------ */
/* Gider kalemleri (kategoriler)                                       */
/* ------------------------------------------------------------------ */

const categorySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Kalem adı gerekli").max(60),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export async function saveExpenseCategory(input: unknown): Promise<ActionResult> {
  await requireUser(["ADMIN"]);
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { id, name, sortOrder } = parsed.data;

  const existing = await prisma.expenseCategory.findUnique({ where: { name: name.trim() } });
  if (existing && existing.id !== id) {
    return { ok: false, error: `"${name}" zaten kayıtlı.` };
  }

  if (id) {
    await prisma.expenseCategory.update({ where: { id }, data: { name: name.trim(), sortOrder } });
  } else {
    await prisma.expenseCategory.create({ data: { name: name.trim(), sortOrder } });
  }
  revalidateFinance();
  return { ok: true };
}

export async function deleteExpenseCategory(id: string): Promise<ActionResult> {
  await requireUser(["ADMIN"]);
  const category = await prisma.expenseCategory.findUnique({ where: { id } });
  if (!category) return { ok: false, error: "Kalem bulunamadı." };

  const used = await prisma.transaction.count({ where: { category: category.name } });
  if (used > 0) {
    return {
      ok: false,
      error: `Bu kalem ${used} kayıtta kullanılıyor. Silmek yerine adını değiştirebilirsiniz.`,
    };
  }
  await prisma.expenseCategory.delete({ where: { id } });
  revalidateFinance();
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Tedarikciler                                                        */
/* ------------------------------------------------------------------ */

const supplierSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Tedarikçi adı gerekli").max(100),
  contactName: z.string().max(100).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  isActive: z.boolean().default(true),
});

export async function saveSupplier(input: unknown): Promise<ActionResult> {
  await requireUser(["ADMIN"]);
  const parsed = supplierSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { id, name, contactName, phone, notes, isActive } = parsed.data;

  const data = {
    name: name.trim(),
    contactName: contactName?.trim() || null,
    phone: phone?.trim() || null,
    notes: notes?.trim() || null,
    isActive,
  };

  if (id) await prisma.supplier.update({ where: { id }, data });
  else await prisma.supplier.create({ data });

  revalidateFinance();
  return { ok: true };
}

export async function deleteSupplier(id: string): Promise<ActionResult> {
  await requireUser(["ADMIN"]);
  const used = await prisma.transaction.count({ where: { supplierId: id } });
  if (used > 0) {
    return {
      ok: false,
      error: "Bu tedarikçinin hareketleri var, silinemez. Kartı 'pasif' yaparak listeden gizleyebilirsiniz.",
    };
  }
  await prisma.supplier.delete({ where: { id } });
  revalidateFinance();
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Gelir / gider hareketleri                                           */
/* ------------------------------------------------------------------ */

const transactionSchema = z
  .object({
    id: z.string().optional(),
    type: z.enum(["INCOME", "EXPENSE"]),
    amount: z.coerce.number().positive("Tutar 0'dan büyük olmalı"),
    description: z.string().min(1, "Açıklama gerekli").max(200),
    category: z.string().max(60).optional().nullable(),
    documentNo: z.string().max(60).optional().nullable(),
    supplierId: z.string().optional().nullable(),
    date: z.string().min(1, "Tarih gerekli"),
    /** true ise pesin, false ise veresiye (borç) */
    isPaid: z.boolean().default(true),
    dueDate: z.string().optional().nullable(),
  })
  .refine((v) => v.type === "EXPENSE" || v.isPaid, {
    message: "Gelir kayıtları vadeli olamaz.",
    path: ["isPaid"],
  });

export async function saveTransaction(input: unknown): Promise<ActionResult> {
  await requireUser(["ADMIN"]);
  const parsed = transactionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;

  const supplierId = v.supplierId && v.supplierId !== "none" ? v.supplierId : null;
  const now = new Date();

  const data = {
    type: v.type,
    amount: v.amount,
    description: v.description.trim(),
    category: v.category?.trim() || null,
    documentNo: v.documentNo?.trim() || null,
    supplierId,
    date: new Date(v.date),
    paidAmount: v.isPaid ? v.amount : 0,
    settledAt: v.isPaid ? now : null,
    dueDate: v.dueDate ? new Date(v.dueDate) : null,
  };

  if (v.id) {
    const current = await prisma.transaction.findUnique({ where: { id: v.id } });
    if (!current) return { ok: false, error: "Kayıt bulunamadı." };
    if (current.orderId) return { ok: false, error: "Otomatik gelir kayıtları düzenlenemez." };
    // Kismi odemeler yapilmissa odenen tutar korunur
    await prisma.transaction.update({
      where: { id: v.id },
      data: {
        ...data,
        paidAmount: current.paidAmount > 0 ? current.paidAmount : data.paidAmount,
        settledAt: current.paidAmount >= v.amount ? (current.settledAt ?? now) : data.settledAt,
      },
    });
  } else {
    await prisma.transaction.create({ data });
  }

  revalidateFinance();
  return { ok: true };
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  await requireUser(["ADMIN"]);
  const tx = await prisma.transaction.findUnique({ where: { id } });
  if (!tx) return { ok: false, error: "Kayıt bulunamadı." };
  if (tx.orderId) {
    return {
      ok: false,
      error: "Bu gelir bir siparişten otomatik oluştu. Silmek için siparişi iptal edin.",
    };
  }
  await prisma.transaction.delete({ where: { id } });
  revalidateFinance();
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Tedarikciye odeme                                                   */
/* ------------------------------------------------------------------ */

const paymentSchema = z.object({
  transactionId: z.string().min(1),
  amount: z.coerce.number().positive("Ödeme tutarı 0'dan büyük olmalı"),
  method: z.string().max(40).optional().nullable(),
  note: z.string().max(200).optional().nullable(),
  date: z.string().min(1),
});

/** Bir gider kalemine (faturaya) odeme isler; kismi odeme desteklenir. */
export async function payExpense(input: unknown): Promise<ActionResult> {
  await requireUser(["ADMIN"]);
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { transactionId, amount, method, note, date } = parsed.data;

  const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!tx) return { ok: false, error: "Kayıt bulunamadı." };
  if (tx.type !== "EXPENSE") return { ok: false, error: "Yalnızca gider kalemleri ödenebilir." };

  const remaining = Math.round((tx.amount - tx.paidAmount) * 100) / 100;
  if (remaining <= 0) return { ok: false, error: "Bu kalem zaten tamamen ödenmiş." };
  if (amount > remaining + 0.001) {
    return { ok: false, error: `Kalan borç ${remaining.toFixed(2)} ₺. Daha fazlasını ödeyemezsiniz.` };
  }

  const newPaid = Math.round((tx.paidAmount + amount) * 100) / 100;

  await prisma.$transaction(async (db: Prisma.TransactionClient) => {
    if (tx.supplierId) {
      await db.supplierPayment.create({
        data: {
          supplierId: tx.supplierId,
          transactionId: tx.id,
          amount,
          method: method?.trim() || null,
          note: note?.trim() || null,
          date: new Date(date),
        },
      });
    }
    await db.transaction.update({
      where: { id: tx.id },
      data: {
        paidAmount: newPaid,
        settledAt: newPaid >= tx.amount ? new Date(date) : null,
      },
    });
  });

  revalidateFinance();
  return { ok: true };
}
