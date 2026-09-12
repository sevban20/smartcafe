import Link from "next/link";
import { Percent, TrendingDown, TrendingUp, Wallet, HandCoins } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getDailySeries, getDebtSummary, getExpenseBreakdown, getSummary, resolvePeriod } from "@/lib/stats";
import { StatCard } from "@/components/admin/stat-card";
import { FinanceChart } from "@/components/admin/finance-chart";
import { ExpenseBreakdownChart } from "@/components/admin/expense-breakdown-chart";
import { TransactionsPanel, type TransactionRow } from "@/components/admin/transactions-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Finans" };

const PERIODS = [
  { key: "buay", label: "Bu ay" },
  { key: "gecenay", label: "Geçen ay" },
  { key: "son3ay", label: "Son 3 ay" },
  { key: "buyil", label: "Bu yıl" },
  { key: "tumu", label: "Tümü" },
];

type TxRow = {
  id: string;
  type: "INCOME" | "EXPENSE";
  amount: number;
  paidAmount: number;
  description: string;
  category: string | null;
  documentNo: string | null;
  supplierId: string | null;
  supplier: { name: string } | null;
  date: Date;
  dueDate: Date | null;
  settledAt: Date | null;
  orderId: string | null;
};

export default async function FinansPage({ searchParams }: { searchParams: { donem?: string } }) {
  const period = resolvePeriod(searchParams.donem);

  const [summary, series, breakdown, debt, transactions, categories, suppliers] = await Promise.all([
    getSummary(period.from, period.to),
    getDailySeries(14),
    getExpenseBreakdown(period.from, period.to),
    getDebtSummary(),
    prisma.transaction.findMany({
      where: { date: { gte: period.from, lt: period.to } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: { supplier: { select: { name: true } } },
      take: 200,
    }),
    prisma.expenseCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.supplier.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const rows: TransactionRow[] = (transactions as TxRow[]).map((t) => ({
    id: t.id,
    type: t.type,
    amount: t.amount,
    paidAmount: t.paidAmount,
    description: t.description,
    category: t.category,
    documentNo: t.documentNo,
    supplierId: t.supplierId,
    supplierName: t.supplier?.name ?? null,
    date: t.date.toISOString(),
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    settledAt: t.settledAt ? t.settledAt.toISOString() : null,
    isAutomatic: Boolean(t.orderId),
  }));

  const margin = summary.income > 0 ? (summary.profit / summary.income) * 100 : 0;

  return (
    <div className="space-y-5">
      <nav className="no-scrollbar flex gap-2 overflow-x-auto">
        {PERIODS.map((p) => (
          <Link
            key={p.key}
            href={`/yonetim/finans?donem=${p.key}`}
            className={cn(
              "whitespace-nowrap rounded-full border px-3 py-1 text-xs transition-colors",
              period.key === p.key ? "border-foreground bg-foreground text-background" : "text-muted-foreground"
            )}
          >
            {p.label}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label={`Gelir · ${period.label}`} value={formatPrice(summary.income)} icon={TrendingUp} tone="positive" />
        <StatCard label={`Gider · ${period.label}`} value={formatPrice(summary.expense)} icon={TrendingDown} tone="negative" />
        <StatCard
          label="Net kâr"
          value={formatPrice(summary.profit)}
          icon={Wallet}
          tone={summary.profit >= 0 ? "positive" : "negative"}
        />
        <StatCard
          label="Kâr marjı"
          value={summary.income > 0 ? `%${margin.toFixed(1)}` : "—"}
          icon={Percent}
          hint={`${summary.orderCount} tamamlanan sipariş`}
        />
        <StatCard
          label="Ödenmemiş borç"
          value={formatPrice(debt.total)}
          icon={HandCoins}
          tone={debt.total > 0 ? "negative" : "default"}
          hint={debt.overdue.length > 0 ? `${debt.overdue.length} kalem vadesi geçti` : "Vadesi geçen yok"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Son 14 gün</CardTitle>
          </CardHeader>
          <CardContent>
            <FinanceChart data={series} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gider kalemleri · {period.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <ExpenseBreakdownChart data={breakdown} />
          </CardContent>
        </Card>
      </div>

      <TransactionsPanel transactions={rows} categories={categories} suppliers={suppliers} />
    </div>
  );
}
