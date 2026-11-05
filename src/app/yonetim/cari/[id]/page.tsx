import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CustomerAccount, type LedgerRow, type CustomerAccountData } from "@/components/admin/customer-account";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cari Hesap" };

type OrderRec = {
  id: string;
  orderNo: number;
  tableNo: string;
  totalAmount: number;
  paidAt: Date | null;
  createdAt: Date;
  orderItems: { productName: string; quantity: number }[];
};

type EntryRec = {
  id: string;
  type: "TAHSILAT" | "BORC";
  amount: number;
  method: string | null;
  note: string | null;
  date: Date;
  user: { name: string } | null;
};

const round = (n: number) => Math.round(n * 100) / 100;

export default async function CariHesapPage({ params }: { params: { id: string } }) {
  const customer = await prisma.customer.findUnique({ where: { id: params.id } });
  if (!customer) notFound();

  const [orders, entries] = (await Promise.all([
    prisma.order.findMany({
      where: { customerId: customer.id, status: { not: "CANCELLED" } },
      select: {
        id: true,
        orderNo: true,
        tableNo: true,
        totalAmount: true,
        paidAt: true,
        createdAt: true,
        orderItems: { where: { cancelledAt: null }, select: { productName: true, quantity: true } },
      },
    }),
    prisma.customerEntry.findMany({
      where: { customerId: customer.id },
      select: {
        id: true,
        type: true,
        amount: true,
        method: true,
        note: true,
        date: true,
        user: { select: { name: true } },
      },
    }),
  ])) as [OrderRec[], EntryRec[]];

  // Ekstre: tum hareketler tarih sirasina dizilip yuruyen bakiye hesaplanir
  const rows: Omit<LedgerRow, "balanceAfter">[] = [
    ...orders.map((o) => ({
      id: o.id,
      kind: "SATIS" as const,
      date: (o.paidAt ?? o.createdAt).toISOString(),
      title: `Sipariş #${o.orderNo} · Masa ${o.tableNo}`,
      detail: o.orderItems.map((i) => `${i.quantity}× ${i.productName}`).join(", "),
      amount: o.totalAmount,
    })),
    ...entries.map((e) => ({
      id: e.id,
      kind: e.type,
      date: e.date.toISOString(),
      title: e.type === "TAHSILAT" ? `Tahsilat${e.method ? ` · ${e.method}` : ""}` : "Elle borç",
      detail: [e.note, e.user?.name ? `giren: ${e.user.name}` : null].filter(Boolean).join(" · "),
      amount: e.amount,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  let running = 0;
  let sales = 0;
  let manualDebt = 0;
  let collected = 0;
  const ledger: LedgerRow[] = rows.map((r) => {
    if (r.kind === "TAHSILAT") {
      running -= r.amount;
      collected += r.amount;
    } else {
      running += r.amount;
      if (r.kind === "SATIS") sales += r.amount;
      else manualDebt += r.amount;
    }
    return { ...r, balanceAfter: round(running) };
  });

  const data: CustomerAccountData = {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    notes: customer.notes,
    creditLimit: customer.creditLimit,
    isActive: customer.isActive,
    balance: round(running),
    sales: round(sales),
    manualDebt: round(manualDebt),
    collected: round(collected),
    // En yeni hareket ustte
    ledger: ledger.reverse(),
  };

  return <CustomerAccount customer={data} />;
}
