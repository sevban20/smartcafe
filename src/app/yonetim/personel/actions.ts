"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guards";
import type { ActionResult } from "@/app/yonetim/actions";

const userSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Ad gerekli").max(80),
  email: z.string().email("Geçerli bir e-posta girin"),
  phone: z.string().max(40).optional().nullable(),
  role: z.enum(["ADMIN", "STAFF"]),
  isActive: z.boolean().default(true),
  /** Yeni kullanicida zorunlu, duzenlemede bos birakilirsa degismez */
  password: z.string().max(72).optional().nullable(),
});

export async function saveUser(input: unknown): Promise<ActionResult> {
  await requireUser(["ADMIN"]);
  const parsed = userSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;

  const email = v.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.id !== v.id) {
    return { ok: false, error: "Bu e-posta zaten kayıtlı." };
  }

  const password = v.password?.trim();

  if (v.id) {
    if (password && password.length < 6) {
      return { ok: false, error: "Şifre en az 6 karakter olmalı." };
    }
    // Son yoneticinin yetkisi dusurulemez / pasife alinamaz
    const current = await prisma.user.findUnique({ where: { id: v.id } });
    if (!current) return { ok: false, error: "Kullanıcı bulunamadı." };
    if (current.role === "ADMIN" && (v.role !== "ADMIN" || !v.isActive)) {
      const activeAdmins = await prisma.user.count({ where: { role: "ADMIN", isActive: true } });
      if (activeAdmins <= 1) {
        return { ok: false, error: "Sistemde en az bir aktif yönetici kalmalı." };
      }
    }

    await prisma.user.update({
      where: { id: v.id },
      data: {
        name: v.name.trim(),
        email,
        phone: v.phone?.trim() || null,
        role: v.role,
        isActive: v.isActive,
        ...(password ? { password: await bcrypt.hash(password, 10) } : {}),
      },
    });
  } else {
    if (!password || password.length < 6) {
      return { ok: false, error: "Yeni kullanıcı için en az 6 karakterlik bir şifre girin." };
    }
    await prisma.user.create({
      data: {
        name: v.name.trim(),
        email,
        phone: v.phone?.trim() || null,
        role: v.role,
        isActive: v.isActive,
        password: await bcrypt.hash(password, 10),
      },
    });
  }

  revalidatePath("/yonetim/personel");
  return { ok: true };
}

export async function deleteUser(id: string): Promise<ActionResult> {
  const me = await requireUser(["ADMIN"]);
  if (me.id === id) return { ok: false, error: "Kendi hesabınızı silemezsiniz." };

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return { ok: false, error: "Kullanıcı bulunamadı." };

  if (user.role === "ADMIN") {
    const activeAdmins = await prisma.user.count({ where: { role: "ADMIN", isActive: true } });
    if (activeAdmins <= 1) return { ok: false, error: "Sistemde en az bir aktif yönetici kalmalı." };
  }

  const takenOrders = await prisma.order.count({ where: { takenById: id } });
  if (takenOrders > 0) {
    return {
      ok: false,
      error: `Bu kullanıcının aldığı ${takenOrders} sipariş var. Silmek yerine "Pasif" yapın (geçmiş korunur).`,
    };
  }

  await prisma.user.delete({ where: { id } });
  revalidatePath("/yonetim/personel");
  return { ok: true };
}
