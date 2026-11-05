import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/guards";
import { getCustomerBalances } from "@/lib/cari";

export const dynamic = "force-dynamic";

/**
 * Masa kapatirken "Cariye Yaz" listesi: aktif cari musteriler ve bakiyeleri.
 * Personel de gorebilir (hesabi o kapatiyor); yeni musteri yalnizca yonetici acar.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const customers = await prisma.customer.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, phone: true, creditLimit: true },
  });
  const balances = await getCustomerBalances(customers.map((c: { id: string }) => c.id));

  return NextResponse.json({
    canCreate: user.role === "ADMIN",
    customers: customers.map((c: { id: string; name: string; phone: string | null; creditLimit: number | null }) => ({
      ...c,
      balance: balances.get(c.id)?.balance ?? 0,
    })),
  });
}

const createSchema = z.object({
  name: z.string().trim().min(1, "Müşteri adı gerekli").max(100),
  phone: z.string().trim().max(40).optional().nullable(),
});

/** Masa kapatma ekranindan hizli musteri ekleme (yalnizca yonetici) */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yeni cari müşteriyi yalnızca yönetici ekleyebilir." }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const customer = await prisma.customer.create({
    data: { name: parsed.data.name, phone: parsed.data.phone || null },
    select: { id: true, name: true, phone: true, creditLimit: true },
  });
  return NextResponse.json({ customer: { ...customer, balance: 0 } });
}
