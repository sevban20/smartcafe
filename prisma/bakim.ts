/**
 * Veritabani bakim araci.
 *
 *   npm run db:durum                          -> sayilari ve tutarsizliklari raporlar (hicbir sey degistirmez)
 *   npm run db:onar                           -> askida kalan siparisleri ve eksik gelir kayitlarini duzeltir
 *   npm run db:temizle -- --siparisler        -> tum siparisleri ve onlara bagli otomatik gelirleri siler
 *   npm run db:temizle -- --finans            -> elle girilen gelir/giderleri ve tedarikci odemelerini siler
 *   npm run db:temizle -- --tedarikciler      -> tedarikci kartlarini siler
 *   npm run db:temizle -- --tumu              -> yukaridakilerin hepsi
 *   ... sonuna --numara-sifirla eklersen siparis numarasi 1'den baslar
 *   npm run db:sifre -- eposta@ornek.com yeniSifre123  -> o kullanicinin sifresini sifirlar
 *                                                          (uygulamada "sifremi unuttum" akisi yok;
 *                                                          admin dahil herkesin sifresi kilitlenirse
 *                                                          VPS'e girip bu komut calistirilir)
 *
 * Silme islemleri --onayla olmadan CALISMAZ, sadece ne silinecegini gosterir.
 * Kullanicilar, menu ve gider kalemleri ASLA silinmez.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const args = process.argv.slice(2);
const has = (flag: string) => args.includes(flag);
const money = (n: number) => `${n.toFixed(2)} TL`;

async function durum() {
  const [orders, paidStuck, missingIncome, income, expense, unpaidExpense, suppliers, payments] =
    await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { paidAt: { not: null }, status: { not: "COMPLETED" } } }),
      prisma.order.findMany({
        where: { status: "COMPLETED", transaction: { is: null } },
        select: { id: true, orderNo: true, tableNo: true, totalAmount: true, paidAt: true },
      }),
      prisma.transaction.count({ where: { type: "INCOME" } }),
      prisma.transaction.count({ where: { type: "EXPENSE" } }),
      prisma.transaction.count({ where: { type: "EXPENSE", settledAt: null } }),
      prisma.supplier.count(),
      prisma.supplierPayment.count(),
    ]);

  console.log("\n=== DURUM ===");
  console.log(`Siparis                 : ${orders}`);
  console.log(`Gelir kaydi             : ${income}`);
  console.log(`Gider kaydi             : ${expense} (${unpaidExpense} tanesi odenmemis)`);
  console.log(`Tedarikci / odeme       : ${suppliers} / ${payments}`);
  console.log("\n--- Tutarsizliklar ---");
  console.log(`Odenmis ama tamamlanmamis siparis : ${paidStuck}`);
  console.log(`Tamamlanmis ama geliri yok        : ${missingIncome.length}`);

  if (missingIncome.length > 0) {
    const total = missingIncome.reduce((s, o) => s + o.totalAmount, 0);
    console.log(`  Toplam kayip ciro: ${money(total)}`);
    for (const o of missingIncome.slice(0, 10)) {
      console.log(`  #${o.orderNo} Masa ${o.tableNo} · ${money(o.totalAmount)}`);
    }
    if (missingIncome.length > 10) console.log(`  ... ve ${missingIncome.length - 10} tane daha`);
  }

  if (paidStuck > 0 || missingIncome.length > 0) {
    console.log("\n-> Duzeltmek icin: npm run db:onar");
  } else {
    console.log("\nHer sey tutarli.");
  }
}

async function onar() {
  // 1) Odenmis ama TAMAMLANDI olmayan siparisleri tamamla
  const stuck = await prisma.order.findMany({
    where: { paidAt: { not: null }, status: { not: "COMPLETED" } },
    select: { id: true, orderNo: true },
  });
  if (stuck.length > 0) {
    await prisma.order.updateMany({
      where: { id: { in: stuck.map((o) => o.id) } },
      data: { status: "COMPLETED" },
    });
    console.log(`${stuck.length} siparis TAMAMLANDI olarak isaretlendi.`);
  }

  // 2) Tamamlanmis ama gelir kaydi olmayan siparislere gelir yaz
  const missing = await prisma.order.findMany({
    where: { status: "COMPLETED", transaction: { is: null } },
    select: { id: true, orderNo: true, tableNo: true, totalAmount: true, paidAt: true, paymentMethod: true, createdAt: true },
  });
  if (missing.length > 0) {
    await prisma.transaction.createMany({
      data: missing.map((o) => ({
        type: "INCOME" as const,
        amount: o.totalAmount,
        description: `Siparis #${o.orderNo} · Masa ${o.tableNo}`,
        category: o.paymentMethod ? `Satis · ${o.paymentMethod}` : "Satis",
        orderId: o.id,
        date: o.paidAt ?? o.createdAt,
      })),
    });
    const total = missing.reduce((s, o) => s + o.totalAmount, 0);
    console.log(`${missing.length} siparis icin gelir kaydi olusturuldu (${money(total)}).`);
  }

  // 3) Iptal edilmis siparislerin gelir kaydi varsa temizle
  const ghost = await prisma.transaction.deleteMany({
    where: { type: "INCOME", order: { status: "CANCELLED" } },
  });
  if (ghost.count > 0) console.log(`${ghost.count} iptal siparisin gelir kaydi silindi.`);

  if (stuck.length === 0 && missing.length === 0 && ghost.count === 0) {
    console.log("Duzeltilecek bir sey yok.");
  }
}

async function temizle() {
  const tumu = has("--tumu");
  const silSiparis = tumu || has("--siparisler");
  const silFinans = tumu || has("--finans");
  const silTedarikci = tumu || has("--tedarikciler");
  const onayli = has("--onayla");
  const numaraSifirla = has("--numara-sifirla");

  if (!silSiparis && !silFinans && !silTedarikci) {
    console.log("Ne silinecegini belirt: --siparisler | --finans | --tedarikciler | --tumu");
    return;
  }

  const [orders, autoIncome, manualTx, suppliers, payments] = await Promise.all([
    prisma.order.count(),
    prisma.transaction.count({ where: { orderId: { not: null } } }),
    prisma.transaction.count({ where: { orderId: null } }),
    prisma.supplier.count(),
    prisma.supplierPayment.count(),
  ]);

  console.log("\n=== SILINECEKLER ===");
  if (silSiparis) console.log(`Siparis: ${orders} (+ ${autoIncome} otomatik gelir kaydi)`);
  if (silFinans) console.log(`Elle girilen gelir/gider: ${manualTx} (+ ${payments} tedarikci odemesi)`);
  if (silTedarikci) console.log(`Tedarikci karti: ${suppliers}`);
  if (numaraSifirla) console.log("Siparis numarasi 1'e sifirlanacak");
  console.log("Korunanlar: kullanicilar, menu (kategori/urun/secenekler), gider kalemleri");

  if (!onayli) {
    console.log("\nGERCEKTEN SILMEK ICIN sonuna --onayla ekle. Simdilik hicbir sey silinmedi.");
    return;
  }

  if (silFinans || silTedarikci) {
    const r = await prisma.supplierPayment.deleteMany({});
    console.log(`${r.count} tedarikci odemesi silindi.`);
  }
  if (silFinans) {
    const r = await prisma.transaction.deleteMany({ where: { orderId: null } });
    console.log(`${r.count} elle girilen gelir/gider silindi.`);
  }
  if (silSiparis) {
    const r1 = await prisma.transaction.deleteMany({ where: { orderId: { not: null } } });
    const r2 = await prisma.order.deleteMany({});
    console.log(`${r2.count} siparis ve ${r1.count} otomatik gelir kaydi silindi.`);
  }
  if (silTedarikci) {
    const r = await prisma.supplier.deleteMany({});
    console.log(`${r.count} tedarikci silindi.`);
  }
  if (numaraSifirla) {
    await prisma.$executeRawUnsafe('ALTER SEQUENCE "Order_orderNo_seq" RESTART WITH 1');
    console.log("Siparis numarasi 1'den baslayacak.");
  }

  console.log("\nTemizlik tamam.");
}

async function sifre() {
  const email = args[1]?.toLowerCase().trim();
  const yeniSifre = args[2];

  if (!email || !yeniSifre) {
    console.log("Kullanim: npm run db:sifre -- eposta@ornek.com yeniSifre123");
    return;
  }
  if (yeniSifre.length < 6) {
    console.log("Sifre en az 6 karakter olmali.");
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log(`"${email}" ile bir kullanici bulunamadi.`);
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { password: await bcrypt.hash(yeniSifre, 10) },
  });
  console.log(`${user.name} (${email}) icin sifre guncellendi.`);
}

async function main() {
  const komut = args[0];
  if (komut === "durum") await durum();
  else if (komut === "onar") await onar();
  else if (komut === "temizle") await temizle();
  else if (komut === "sifre") await sifre();
  else {
    console.log("Kullanim: durum | onar | temizle | sifre");
    console.log("Ornek: npm run db:temizle -- --siparisler --onayla --numara-sifirla");
    console.log("Ornek: npm run db:sifre -- eposta@ornek.com yeniSifre123");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
