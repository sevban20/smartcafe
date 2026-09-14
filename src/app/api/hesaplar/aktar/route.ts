import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/guards";
import { rateLimit } from "@/lib/rate-limit";
import type { OrderStatus, Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const aktarSchema = z.object({
  fromTable: z.string().min(1).max(20),
  toTable: z.string().min(1).max(20),
  /// Alan hic gonderilmezse masadaki TUM acik siparisler tasinir.
  /// Gonderilirse en az bir siparis icermeli (bos dizi "hepsi" demek degildir).
  orderIds: z.array(z.string()).min(1).optional(),
  /// Hedef masada zaten acik hesap varsa, birlestirme onayi
  mergeOnay: z.boolean().optional(),
  note: z.string().max(200).optional().nullable(),
});

type OpenRow = { id: string; orderNo: number; totalAmount: number; status: OrderStatus };

/** Istemciye 409 olarak donecek, is kurali kaynakli hatalar */
class AktarimCakismasi extends Error {
  constructor(message: string, readonly ek: Record<string, unknown> = {}) {
    super(message);
  }
}

/**
 * Masa aktarimi: bir masanin acik adisyonunu baska masaya tasir.
 *
 * Senaryo: musteri 1. masada oturuyordu, gunes gelince 3. masaya gecti.
 * Siparisler silinmez/yeniden girilmez — sadece masa numaralari degisir:
 *   - KDS kartlari yeni masayi gosterir (mutfak dogru masaya servis yapar),
 *   - Acik Hesaplar'da 1. masa kapanir, 3. masa adisyonu devralir,
 *   - Musterinin QR ekraninda 1. masa bosalir (yeni masanin QR'i okutulmali).
 *
 * Odenmis (paidAt dolu) veya iptal edilmis siparisler tasinmaz; gecmis bozulmaz.
 * Hedef masada zaten acik hesap varsa iki adisyon BIRLESIR — geri alinamadigi
 * icin istemciden acik onay (mergeOnay) beklenir ve bu onay, yazma isleminin
 * icinde bir kez daha dogrulanir (arada hedefe siparis dusmus olabilir).
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  if (!rateLimit(`aktar:${user.id}`, 40, 5 * 60_000).ok) {
    return NextResponse.json({ error: "Çok fazla istek. Biraz bekleyin." }, { status: 429 });
  }

  const parsed = aktarSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });

  const fromTable = parsed.data.fromTable.trim();
  const toTable = parsed.data.toTable.trim();
  const { orderIds, mergeOnay, note } = parsed.data;

  if (!fromTable || !toTable) {
    return NextResponse.json({ error: "Masa numarası boş olamaz." }, { status: 400 });
  }
  // Masa numaralari serbest metin; "3" ile "3" kadar "A1" ile "a1" de ayni masa sayilir
  if (fromTable.toLocaleLowerCase("tr") === toTable.toLocaleLowerCase("tr")) {
    return NextResponse.json({ error: "Kaynak ve hedef masa aynı." }, { status: 400 });
  }

  const acikFiltre = { paidAt: null, status: { not: "CANCELLED" as OrderStatus } };

  try {
    const sonuc = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Tum okumalar da islem icinde: kontrol ettigimiz durum ile yazdigimiz
      // durum arasina baska bir istek (hesap kapatma, yeni siparis) giremesin.
      const acik: OpenRow[] = await tx.order.findMany({
        where: { tableNo: fromTable, ...acikFiltre },
        select: { id: true, orderNo: true, totalAmount: true, status: true },
        orderBy: { createdAt: "asc" },
      });

      if (acik.length === 0) {
        throw new AktarimCakismasi(`Masa ${fromTable} için açık hesap yok.`);
      }

      // Kismi aktarim: yalnizca secilen siparisler tasinir
      const secili = orderIds ? new Set(orderIds) : null;
      const tasinacak = secili ? acik.filter((o) => secili.has(o.id)) : acik;

      if (secili && tasinacak.length !== secili.size) {
        throw new AktarimCakismasi(
          "Seçilen siparişlerden bazıları artık açık değil. Listeyi yenileyin."
        );
      }

      // Hedef masada acik hesap var mi? (birlestirme onayi)
      const hedefAcik = await tx.order.findMany({
        where: { tableNo: toTable, ...acikFiltre },
        select: { totalAmount: true },
      });

      const merged = hedefAcik.length > 0;
      if (merged && !mergeOnay) {
        throw new AktarimCakismasi(`Masa ${toTable} zaten açık. Onaylarsanız iki hesap birleşir.`, {
          needsMerge: true,
          hedefSiparis: hedefAcik.length,
          hedefTutar: hedefAcik.reduce(
            (s: number, o: { totalAmount: number }) => s + o.totalAmount,
            0
          ),
        });
      }

      const ids = tasinacak.map((o) => o.id);
      const amount = tasinacak.reduce((sum, o) => sum + o.totalAmount, 0);
      const partial = tasinacak.length < acik.length;
      const movedAt = new Date();

      // Kosullari yazarken de tekrarla: arada odenmis/iptal olmus bir siparis tasinmasin
      const guncellenen = await tx.order.updateMany({
        where: { id: { in: ids }, ...acikFiltre },
        data: { tableNo: toTable, movedFromTable: fromTable, movedAt, movedById: user.id },
      });

      if (guncellenen.count !== ids.length) {
        throw new AktarimCakismasi(
          "Siparişlerin durumu az önce değişti (ödendi veya iptal edildi). Listeyi yenileyip tekrar deneyin."
        );
      }

      // Hesap kapanmadan once tamamlanmis siparislerin gelir kaydi zaten olusmus
      // olabilir; aciklamasindaki masa numarasini da guncelle ki finans raporu
      // ile adisyon ayni masayi gostersin.
      const gelirler = await tx.transaction.findMany({
        where: { orderId: { in: ids }, type: "INCOME" },
        select: { id: true, orderId: true },
      });

      for (const t of gelirler as { id: string; orderId: string | null }[]) {
        const order = tasinacak.find((o) => o.id === t.orderId);
        if (!order) continue;
        await tx.transaction.update({
          where: { id: t.id },
          data: { description: `Sipariş #${order.orderNo} · Masa ${toTable}` },
        });
      }

      await tx.tableTransfer.create({
        data: {
          fromTable,
          toTable,
          orderCount: tasinacak.length,
          amount,
          merged,
          partial,
          note: note?.trim() || null,
          userId: user.id,
        },
      });

      return { moved: tasinacak.length, amount, merged, partial };
    });

    return NextResponse.json({ ok: true, fromTable, toTable, ...sonuc });
  } catch (error) {
    if (error instanceof AktarimCakismasi) {
      return NextResponse.json({ error: error.message, ...error.ek }, { status: 409 });
    }
    console.error("[aktar] masa aktarimi basarisiz:", error);
    return NextResponse.json({ error: "Masa aktarılamadı." }, { status: 500 });
  }
}

/** Son masa aktarimlari (yonetim ekraninda denetim izi olarak listelenir) */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  // Diger yonetim raporlari gibi bu da yalnizca yoneticiye acik
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

  const transfers = await prisma.tableTransfer.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true } } },
    take: 50,
  });

  return NextResponse.json({ transfers });
}
