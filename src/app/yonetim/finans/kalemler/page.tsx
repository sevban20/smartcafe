import { prisma } from "@/lib/prisma";
import { ExpenseCategories, type ExpenseCategoryRow } from "@/components/admin/expense-categories";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Gider Kalemleri" };

type Grouped = { category: string | null; _sum: { amount: number | null }; _count: { _all: number } };

export default async function KalemlerPage() {
  const [categories, usage] = await Promise.all([
    prisma.expenseCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.transaction.groupBy({
      by: ["category"],
      where: { type: "EXPENSE" },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  const usageMap = new Map(
    (usage as Grouped[]).map((u) => [u.category ?? "", { count: u._count._all, total: u._sum.amount ?? 0 }])
  );

  const rows: ExpenseCategoryRow[] = categories.map((c: { id: string; name: string; sortOrder: number }) => {
    const stat = usageMap.get(c.name);
    return {
      id: c.id,
      name: c.name,
      sortOrder: c.sortOrder,
      usageCount: stat?.count ?? 0,
      total: Math.round((stat?.total ?? 0) * 100) / 100,
    };
  });

  return <ExpenseCategories categories={rows} />;
}
