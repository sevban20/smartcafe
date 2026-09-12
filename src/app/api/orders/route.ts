import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/guards";
import { sendPushToStaff } from "@/lib/push";
import { claimOnce, clientIp, rateLimit } from "@/lib/rate-limit";
import type { OrderStatus, Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const orderSchema = z.object({
  tableNo: z.string().min(1, "Masa numarası gerekli").max(20),
  notes: z.string().max(500).optional().nullable(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1).max(50),
        choiceIds: z.array(z.string()).default([]),
      })
    )
    .min(1, "Sepet boş"),
});

/**
 * Musteri siparisi olusturur.
 * Guvenlik: fiyatlar ISTEMCIDEN ALINMAZ, her zaman veritabanindan yeniden hesaplanir.
 */
export async function POST(req: Request) {
  try {
    // Giris yapmis biri siparis giriyorsa bu bir GARSON siparisidir.
    // Oturum sunucuda okunur, istemci bunu taklit edemez.
    const staff = await getCurrentUser();
    const json = await req.json();
    const parsed = orderSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Geçersiz istek" },
        { status: 400 }
      );
    }
    const { tableNo, notes, items } = parsed.data;

    // --- Kotuye kullanim korumasi ---
    // Ayni sepetin saniyeler icinde tekrar gonderilmesini engelle (cift tiklama dahil)
    const fingerprint = [
      tableNo.trim(),
      ...items
        .map((i) => `${i.productId}:${i.quantity}:${[...i.choiceIds].sort().join(",")}`)
        .sort(),
    ].join("|");

    if (!claimOnce(fingerprint)) {
      return NextResponse.json(
        { error: "Bu sipariş az önce gönderildi. Lütfen birkaç saniye bekleyin." },
        { status: 429 }
      );
    }

    // Giris yapmamis (QR'dan gelen) istekler icin adet siniri
    if (!staff) {
      const ip = clientIp(req);
      const perIp = rateLimit(`siparis:ip:${ip}`, 8, 10 * 60_000);
      if (!perIp.ok) {
        return NextResponse.json(
          { error: "Çok fazla sipariş denemesi. Lütfen personele başvurun." },
          { status: 429, headers: { "Retry-After": String(perIp.retryAfter) } }
        );
      }
      const perTable = rateLimit(`siparis:masa:${tableNo.trim()}`, 10, 10 * 60_000);
      if (!perTable.ok) {
        return NextResponse.json(
          { error: "Bu masa için çok fazla sipariş oluşturuldu. Lütfen personele başvurun." },
          { status: 429, headers: { "Retry-After": String(perTable.retryAfter) } }
        );
      }
    }

    const productIds = Array.from(new Set(items.map((i) => i.productId)));
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { options: { include: { choices: true } } },
    });

    if (products.length !== productIds.length) {
      return NextResponse.json({ error: "Menüde olmayan bir ürün var." }, { status: 400 });
    }
    const unavailable = products.find((p) => !p.isAvailable);
    if (unavailable) {
      return NextResponse.json(
        { error: `"${unavailable.name}" şu an mevcut değil.` },
        { status: 400 }
      );
    }

    let totalAmount = 0;
    const itemsData: Prisma.OrderItemCreateWithoutOrderInput[] = [];

    for (const item of items) {
      const product = products.find((p) => p.id === item.productId)!;
      const chosen = new Set(item.choiceIds);
      const selected: { optionName: string; choiceName: string; extraPrice: number }[] = [];

      for (const option of product.options) {
        const picked = option.choices.filter((c) => chosen.has(c.id));

        if (option.isRequired && picked.length === 0) {
          return NextResponse.json(
            { error: `"${product.name}" için "${option.name}" seçimi zorunlu.` },
            { status: 400 }
          );
        }
        if (!option.isMultiple && picked.length > 1) {
          return NextResponse.json(
            { error: `"${option.name}" için yalnızca bir seçim yapılabilir.` },
            { status: 400 }
          );
        }
        for (const c of picked) {
          selected.push({ optionName: option.name, choiceName: c.name, extraPrice: c.extraPrice });
        }
      }

      const unitPrice = selected.reduce((s, o) => s + o.extraPrice, product.price);
      const linePrice = unitPrice * item.quantity;
      totalAmount += linePrice;

      itemsData.push({
        product: { connect: { id: product.id } },
        productName: product.name,
        quantity: item.quantity,
        basePrice: product.price,
        totalPrice: linePrice,
        selectedOptions: { create: selected },
      });
    }

    const order = await prisma.order.create({
      data: {
        tableNo: tableNo.trim(),
        notes: notes?.trim() || null,
        totalAmount: Math.round(totalAmount * 100) / 100,
        source: staff ? "PERSONEL" : "QR",
        takenById: staff?.id ?? null,
        orderItems: { create: itemsData },
      },
      select: { id: true, orderNo: true, totalAmount: true, tableNo: true },
    });

    // Personele bildirim gonder — basarisiz olsa bile siparis akisi etkilenmez
    const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
    if (!staff) {
      void sendPushToStaff({
        title: `Yeni sipariş · Masa ${order.tableNo}`,
        body: `#${order.orderNo} · ${itemCount} ürün · ${order.totalAmount.toFixed(2)} ₺`,
        url: "/kds",
        tag: `order-${order.id}`,
      }).catch((e) => console.error("Push bildirimi gönderilemedi:", e));
    }

    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    console.error("Sipariş oluşturulamadı:", error);
    return NextResponse.json({ error: "Sipariş oluşturulamadı." }, { status: 500 });
  }
}

/** KDS ve yonetim icin siparis listesi (giris gerekli). */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status");
  const onlyMine = searchParams.get("benim") === "1";
  const statuses = statusParam
    ? (statusParam.split(",").filter(Boolean) as OrderStatus[])
    : (["PENDING", "PREPARING"] as OrderStatus[]);

  const orders = await prisma.order.findMany({
    where: {
      status: { in: statuses },
      ...(onlyMine ? { takenById: user.id } : {}),
    },
    orderBy: { createdAt: "asc" },
    include: {
      orderItems: { include: { selectedOptions: true }, orderBy: { cancelledAt: "asc" } },
      takenBy: { select: { name: true } },
      cancelledBy: { select: { name: true } },
    },
    take: 100,
  });

  return NextResponse.json({ orders });
}
