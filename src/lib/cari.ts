import { prisma } from "@/lib/prisma";

/** Cari ile kapatilan hesaplarin paymentMethod degeri */
export const CARI_METHOD = "Cari";

export type CustomerBalance = {
  /** Cariye yazilan siparislerin toplami (iptaller haric) */
  sales: number;
  /** Elle girilen borclar (devir vb.) */
  manualDebt: number;
  /** Alinan odemeler */
  collected: number;
  /** Guncel borc = sales + manualDebt - collected */
  balance: number;
  lastActivity: Date | null;
};

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Musterilerin bakiyelerini hesaplar. Bakiye saklanmaz, her seferinde
 * hareketlerden turetilir: boylece kalem iptali, siparis iptali gibi sonradan
 * yapilan duzeltmeler cari hesaba kendiliginden yansir.
 */
export async function getCustomerBalances(customerIds?: string[]): Promise<Map<string, CustomerBalance>> {
  const idFilter = customerIds ? { in: customerIds } : { not: null };

  const [orderSums, entrySums] = await Promise.all([
    prisma.order.groupBy({
      by: ["customerId"],
      where: { customerId: idFilter, status: { not: "CANCELLED" } },
      _sum: { totalAmount: true },
      _max: { paidAt: true },
    }),
    prisma.customerEntry.groupBy({
      by: ["customerId", "type"],
      where: customerIds ? { customerId: { in: customerIds } } : undefined,
      _sum: { amount: true },
      _max: { date: true },
    }),
  ]);

  const map = new Map<string, CustomerBalance>();
  const get = (id: string) => {
    let b = map.get(id);
    if (!b) {
      b = { sales: 0, manualDebt: 0, collected: 0, balance: 0, lastActivity: null };
      map.set(id, b);
    }
    return b;
  };
  const touch = (b: CustomerBalance, d: Date | null | undefined) => {
    if (d && (!b.lastActivity || d > b.lastActivity)) b.lastActivity = d;
  };

  for (const row of orderSums as { customerId: string | null; _sum: { totalAmount: number | null }; _max: { paidAt: Date | null } }[]) {
    if (!row.customerId) continue;
    const b = get(row.customerId);
    b.sales += row._sum.totalAmount ?? 0;
    touch(b, row._max.paidAt);
  }
  for (const row of entrySums as { customerId: string; type: "TAHSILAT" | "BORC"; _sum: { amount: number | null }; _max: { date: Date | null } }[]) {
    const b = get(row.customerId);
    if (row.type === "TAHSILAT") b.collected += row._sum.amount ?? 0;
    else b.manualDebt += row._sum.amount ?? 0;
    touch(b, row._max.date);
  }

  map.forEach((b) => {
    b.sales = round(b.sales);
    b.manualDebt = round(b.manualDebt);
    b.collected = round(b.collected);
    b.balance = round(b.sales + b.manualDebt - b.collected);
  });
  return map;
}

export async function getCustomerBalance(customerId: string): Promise<CustomerBalance> {
  const map = await getCustomerBalances([customerId]);
  return map.get(customerId) ?? { sales: 0, manualDebt: 0, collected: 0, balance: 0, lastActivity: null };
}

/** Ozet ekrani icin: toplam musteri alacagi */
export async function getReceivableSummary() {
  const [balances, customers] = await Promise.all([
    getCustomerBalances(),
    prisma.customer.findMany({ select: { id: true, name: true } }),
  ]);
  const rows = customers
    .map((c: { id: string; name: string }) => ({ id: c.id, name: c.name, balance: balances.get(c.id)?.balance ?? 0 }))
    .filter((r: { balance: number }) => r.balance > 0.001)
    .sort((a: { balance: number }, b: { balance: number }) => b.balance - a.balance);
  return { total: round(rows.reduce((s: number, r: { balance: number }) => s + r.balance, 0)), rows };
}
