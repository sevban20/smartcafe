import { prisma } from "@/lib/prisma";
import { APP_TZ, addDays, addMonths, localDayKey, startOfDay, startOfMonth, startOfYear } from "@/lib/tz";

export { startOfDay, addDays, startOfMonth, startOfYear, addMonths } from "@/lib/tz";

export type RangeSummary = {
  income: number;
  expense: number;
  profit: number;
  orderCount: number;
};

export async function getSummary(from: Date, to: Date): Promise<RangeSummary> {
  const [grouped, orderCount] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["type"],
      where: { date: { gte: from, lt: to } },
      _sum: { amount: true },
    }),
    prisma.order.count({
      where: { status: "COMPLETED", createdAt: { gte: from, lt: to } },
    }),
  ]);

  const income = grouped.find((g) => g.type === "INCOME")?._sum.amount ?? 0;
  const expense = grouped.find((g) => g.type === "EXPENSE")?._sum.amount ?? 0;

  return { income, expense, profit: income - expense, orderCount };
}

export type DailyPoint = { label: string; gelir: number; gider: number };

/** Son N gunun gunluk gelir/gider serisi (grafik icin) */
export async function getDailySeries(days = 7): Promise<DailyPoint[]> {
  const from = startOfDay(addDays(new Date(), -(days - 1)));
  const to = addDays(startOfDay(), 1);

  const transactions = await prisma.transaction.findMany({
    where: { date: { gte: from, lt: to } },
    select: { type: true, amount: true, date: true },
  });

  const buckets = new Map<string, DailyPoint>();
  for (let i = 0; i < days; i++) {
    const day = addDays(from, i);
    buckets.set(localDayKey(day), {
      label: new Intl.DateTimeFormat("tr-TR", { timeZone: APP_TZ, day: "2-digit", month: "short" }).format(day),
      gelir: 0,
      gider: 0,
    });
  }

  for (const t of transactions) {
    const key = localDayKey(t.date);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (t.type === "INCOME") bucket.gelir += t.amount;
    else bucket.gider += t.amount;
  }

  return Array.from(buckets.values());
}

/** En cok satan urunler (tamamlanmis siparisler uzerinden) */
export async function getTopProducts(from: Date, to: Date, take = 5) {
  const items = await prisma.orderItem.findMany({
    where: { order: { status: "COMPLETED", createdAt: { gte: from, lt: to } } },
    select: { productName: true, quantity: true, totalPrice: true },
  });

  const map = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const item of items) {
    const current = map.get(item.productName) ?? { name: item.productName, quantity: 0, revenue: 0 };
    current.quantity += item.quantity;
    current.revenue += item.totalPrice;
    map.set(item.productName, current);
  }

  return Array.from(map.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, take);
}

/** Tarih araligi on tanimlari (finans ekrani filtreleri) */
export type PeriodKey = "buay" | "gecenay" | "son3ay" | "buyil" | "tumu";

export function resolvePeriod(key?: string): { key: PeriodKey; label: string; from: Date; to: Date } {
  const now = new Date();
  const tomorrow = addDays(startOfDay(now), 1);
  const monthStart = startOfMonth(now);

  switch (key) {
    case "gecenay":
      return { key: "gecenay", label: "Geçen ay", from: addMonths(now, -1), to: monthStart };
    case "son3ay":
      return { key: "son3ay", label: "Son 3 ay", from: addMonths(now, -2), to: tomorrow };
    case "buyil":
      return { key: "buyil", label: "Bu yıl", from: startOfYear(now), to: tomorrow };
    case "tumu":
      return { key: "tumu", label: "Tümü", from: new Date(Date.UTC(2000, 0, 1)), to: tomorrow };
    default:
      return { key: "buay", label: "Bu ay", from: monthStart, to: tomorrow };
  }
}

export type CategorySlice = { name: string; amount: number };

/** Gider kalemlerine gore dagilim (buyukten kucuge) */
export async function getExpenseBreakdown(from: Date, to: Date): Promise<CategorySlice[]> {
  const rows = await prisma.transaction.groupBy({
    by: ["category"],
    where: { type: "EXPENSE", date: { gte: from, lt: to } },
    _sum: { amount: true },
  });

  return rows
    .map((r: { category: string | null; _sum: { amount: number | null } }) => ({
      name: r.category ?? "Kalemsiz",
      amount: r._sum.amount ?? 0,
    }))
    .sort((a: CategorySlice, b: CategorySlice) => b.amount - a.amount);
}

/** Odenmemis tedarikci borclari toplami ve vadesi gecenler */
export async function getDebtSummary() {
  const open = await prisma.transaction.findMany({
    where: { type: "EXPENSE", settledAt: null },
    select: { id: true, amount: true, paidAmount: true, dueDate: true, description: true, supplier: { select: { name: true } } },
    orderBy: [{ dueDate: "asc" }, { date: "asc" }],
  });

  type OpenRow = (typeof open)[number];
  const items = open
    .map((t: OpenRow) => ({
      id: t.id,
      description: t.description,
      supplierName: t.supplier?.name ?? null,
      remaining: Math.round((t.amount - t.paidAmount) * 100) / 100,
      dueDate: t.dueDate,
    }))
    .filter((t: { remaining: number }) => t.remaining > 0.001);

  const now = new Date();
  return {
    total: items.reduce((sum: number, t: { remaining: number }) => sum + t.remaining, 0),
    overdue: items.filter((t: { dueDate: Date | null }) => t.dueDate && t.dueDate < now),
    upcoming: items.filter((t: { dueDate: Date | null }) => !t.dueDate || t.dueDate >= now),
    items,
  };
}

/* ------------------------------------------------------------------ */
/* Iptal raporu                                                        */
/* ------------------------------------------------------------------ */

export type CancelRow = {
  id: string;
  orderNo: number;
  tableNo: string;
  productName: string;
  quantity: number;
  amount: number;
  reason: string | null;
  note: string | null;
  by: string | null;
  at: Date;
  wholeOrder: boolean;
};

export type CancelReport = {
  totalAmount: number;
  wasteAmount: number;
  itemCount: number;
  orderCount: number;
  byReason: { reason: string; amount: number; count: number }[];
  byUser: { name: string; amount: number; count: number }[];
  rows: CancelRow[];
};

/**
 * Belirtilen aralikta iptal edilen KALEMLER uzerinden rapor uretir.
 * Komple iptal edilen siparislerin kalemleri de iptal isaretlendigi icin
 * her iki durum da tek yerden sayilir.
 */
export async function getCancelReport(from: Date, to: Date): Promise<CancelReport> {
  const items = await prisma.orderItem.findMany({
    where: { cancelledAt: { gte: from, lt: to } },
    orderBy: { cancelledAt: "desc" },
    select: {
      id: true,
      productName: true,
      quantity: true,
      totalPrice: true,
      cancelReason: true,
      cancelNote: true,
      cancelledAt: true,
      cancelledBy: { select: { name: true } },
      order: { select: { orderNo: true, tableNo: true, status: true } },
    },
    take: 500,
  });

  type Row = (typeof items)[number];
  const rows: CancelRow[] = (items as Row[]).map((i) => ({
    id: i.id,
    orderNo: i.order.orderNo,
    tableNo: i.order.tableNo,
    productName: i.productName,
    quantity: i.quantity,
    amount: i.totalPrice,
    reason: i.cancelReason,
    note: i.cancelNote,
    by: i.cancelledBy?.name ?? null,
    at: i.cancelledAt!,
    wholeOrder: i.order.status === "CANCELLED",
  }));

  const byReasonMap = new Map<string, { amount: number; count: number }>();
  const byUserMap = new Map<string, { amount: number; count: number }>();
  const orderNos = new Set<number>();
  let totalAmount = 0;
  let wasteAmount = 0;

  for (const r of rows) {
    totalAmount += r.amount;
    if (r.reason === "FIRE") wasteAmount += r.amount;
    orderNos.add(r.orderNo);

    const rKey = r.reason ?? "BELIRTILMEDI";
    const rc = byReasonMap.get(rKey) ?? { amount: 0, count: 0 };
    rc.amount += r.amount;
    rc.count += 1;
    byReasonMap.set(rKey, rc);

    const uKey = r.by ?? "Bilinmiyor";
    const uc = byUserMap.get(uKey) ?? { amount: 0, count: 0 };
    uc.amount += r.amount;
    uc.count += 1;
    byUserMap.set(uKey, uc);
  }

  return {
    totalAmount: Math.round(totalAmount * 100) / 100,
    wasteAmount: Math.round(wasteAmount * 100) / 100,
    itemCount: rows.length,
    orderCount: orderNos.size,
    byReason: Array.from(byReasonMap, ([reason, v]) => ({ reason, ...v })).sort(
      (a, b) => b.amount - a.amount
    ),
    byUser: Array.from(byUserMap, ([name, v]) => ({ name, ...v })).sort((a, b) => b.amount - a.amount),
    rows,
  };
}
