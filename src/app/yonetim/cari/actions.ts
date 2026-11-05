"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guards";
import { getCustomerBalance } from "@/lib/cari";
import type { ActionResult } from "@/app/yonetim/actions";

function revalidateCari(customerId?: string) {
  revalidatePath("/yonetim");
  revalidatePath("/yonetim/cari");
  if (customerId) revalidatePath(`/yonetim/cari/${customerId}`);
}

/** "2026-11-05" -> bugunse su an, degilse o gunun ogle saati (ekstrede dogru siraya girsin) */
function parseDay(value: string): Date {
  const today = new Date().toISOString().slice(0, 10);
  if (value === today) return new Date();
  const d = new Date(`${value}T12:00:00`);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/* ------------------------------------------------------------------ */
/* Musteri karti                                                       */
/* ------------------------------------------------------------------ */

const customerSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Müşteri adı gerekli").max(100),
  phone: z.string().trim().max(40).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  /** Bos birakilirsa limitsiz */
  creditLimit: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .transform((v) => (v === "" || v == null ? null : Number(v)))
    .refine((v) => v === null || (Number.isFinite(v) && v >= 0), "Limit geçerli bir tutar olmalı"),
  isActive: z.boolean().default(true),
});

export async function saveCustomer(input: unknown): Promise<ActionResult> {
  await requireUser(["ADMIN"]);
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { id, name, phone, notes, creditLimit, isActive } = parsed.data;

  const data = { name, phone: phone || null, notes: notes || null, creditLimit, isActive };
  if (id) await prisma.customer.update({ where: { id }, data });
  else await prisma.customer.create({ data });

  revalidateCari(id);
  return { ok: true };
}

export async function deleteCustomer(id: string): Promise<ActionResult> {
  await requireUser(["ADMIN"]);
  const [orders, entries] = await Promise.all([
    prisma.order.count({ where: { customerId: id } }),
    prisma.customerEntry.count({ where: { customerId: id } }),
  ]);
  if (orders + entries > 0) {
    return {
      ok: false,
      error: "Bu müşterinin hesap hareketleri var, silinemez. Kartı 'pasif' yaparak listeden gizleyebilirsiniz.",
    };
  }
  await prisma.customer.delete({ where: { id } });
  revalidateCari();
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Tahsilat / elle borc                                                */
/* ------------------------------------------------------------------ */

const entrySchema = z.object({
  customerId: z.string().min(1),
  type: z.enum(["TAHSILAT", "BORC"]),
  amount: z.coerce.number().positive("Tutar 0'dan büyük olmalı"),
  method: z.string().max(40).optional().nullable(),
  note: z.string().max(200).optional().nullable(),
  date: z.string().min(1, "Tarih gerekli"),
});

/**
 * Tahsilat: musteriden alinan para borcu dusurur. Satis, hesap cariye
 * yazildigi gun zaten ciroya girdigi icin burada yeni GELIR kaydi ACILMAZ.
 *
 * Borc: sisteme gecmeden onceki devir gibi elle girilen borc. Ciroya yazilmaz.
 */
export async function addCustomerEntry(input: unknown): Promise<ActionResult> {
  const user = await requireUser(["ADMIN"]);
  const parsed = entrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;

  const customer = await prisma.customer.findUnique({ where: { id: v.customerId }, select: { id: true } });
  if (!customer) return { ok: false, error: "Müşteri bulunamadı." };

  if (v.type === "TAHSILAT") {
    const { balance } = await getCustomerBalance(v.customerId);
    if (balance <= 0.001) return { ok: false, error: "Bu müşterinin borcu yok." };
    if (v.amount > balance + 0.001) {
      return { ok: false, error: `Güncel borç ${balance.toFixed(2)} ₺. Daha fazla tahsilat girilemez.` };
    }
  } else if (!v.note?.trim()) {
    return { ok: false, error: "Elle borç girerken açıklama yazın (örn. 'Ekim devri')." };
  }

  await prisma.customerEntry.create({
    data: {
      customerId: v.customerId,
      type: v.type,
      amount: Math.round(v.amount * 100) / 100,
      method: v.type === "TAHSILAT" ? v.method?.trim() || null : null,
      note: v.note?.trim() || null,
      date: parseDay(v.date),
      userId: user.id,
    },
  });

  revalidateCari(v.customerId);
  return { ok: true };
}

export async function deleteCustomerEntry(id: string): Promise<ActionResult> {
  await requireUser(["ADMIN"]);
  const entry = await prisma.customerEntry.findUnique({ where: { id } });
  if (!entry) return { ok: false, error: "Kayıt bulunamadı." };
  await prisma.customerEntry.delete({ where: { id } });
  revalidateCari(entry.customerId);
  return { ok: true };
}
