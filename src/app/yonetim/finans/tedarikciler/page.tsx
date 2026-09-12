import { prisma } from "@/lib/prisma";
import { SupplierManager, type SupplierRow } from "@/components/admin/supplier-manager";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tedarikçiler" };

type SupplierWithTx = {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  notes: string | null;
  isActive: boolean;
  transactions: { amount: number; paidAmount: number; settledAt: Date | null }[];
};

export default async function TedarikcilerPage() {
  const suppliers = (await prisma.supplier.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: {
      transactions: {
        where: { type: "EXPENSE" },
        select: { amount: true, paidAmount: true, settledAt: true },
      },
    },
  })) as SupplierWithTx[];

  const rows: SupplierRow[] = suppliers.map((s) => {
    const open = s.transactions.filter((t) => t.amount - t.paidAmount > 0.001);
    return {
      id: s.id,
      name: s.name,
      contactName: s.contactName,
      phone: s.phone,
      notes: s.notes,
      isActive: s.isActive,
      balance: Math.round(open.reduce((sum, t) => sum + (t.amount - t.paidAmount), 0) * 100) / 100,
      totalSpent: Math.round(s.transactions.reduce((sum, t) => sum + t.amount, 0) * 100) / 100,
      openCount: open.length,
    };
  });

  return <SupplierManager suppliers={rows} />;
}
