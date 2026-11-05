import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guards";
import { getCustomerBalances } from "@/lib/cari";
import { CustomerManager, type CustomerRow } from "@/components/admin/customer-manager";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cari Müşteriler" };

type CustomerRec = {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  creditLimit: number | null;
  isActive: boolean;
};

export default async function CariMusterilerPage() {
  await requireUser(["ADMIN"]);
  const customers = (await prisma.customer.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  })) as CustomerRec[];
  const balances = await getCustomerBalances(customers.map((c) => c.id));

  const rows: CustomerRow[] = customers.map((c) => {
    const b = balances.get(c.id);
    return {
      ...c,
      balance: b?.balance ?? 0,
      totalSales: Math.round(((b?.sales ?? 0) + (b?.manualDebt ?? 0)) * 100) / 100,
      lastActivity: b?.lastActivity ? b.lastActivity.toISOString() : null,
    };
  });

  return <CustomerManager customers={rows} />;
}
