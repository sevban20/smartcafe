import Link from "next/link";
import { AlertCircle, ArrowRight, Coffee, HandCoins, Receipt, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { addDays, getDailySeries, getDebtSummary, getSummary, getTopProducts, startOfDay, startOfMonth } from "@/lib/stats";
import { StatCard } from "@/components/admin/stat-card";
import { FinanceChart } from "@/components/admin/finance-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatPrice, formatTime } from "@/lib/utils";
import { APP_TZ } from "@/lib/tz";
import { ORDER_STATUS_CLASS, ORDER_STATUS_LABEL } from "@/lib/constants";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Özet" };

export default async function YonetimOzetPage() {
  const today = startOfDay();
  const tomorrow = addDays(today, 1);
  const monthStart = startOfMonth();

  const [dayStats, monthStats, series, topProducts, activeOrders, recentOrders, debt] = await Promise.all([
    getSummary(today, tomorrow),
    getSummary(monthStart, tomorrow),
    getDailySeries(7),
    getTopProducts(monthStart, tomorrow, 5),
    prisma.order.count({ where: { status: { in: ["PENDING", "PREPARING"] } } }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, orderNo: true, tableNo: true, status: true, totalAmount: true, createdAt: true },
    }),
    getDebtSummary(),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Günlük Özet</h1>
        <p className="text-sm text-muted-foreground">
          {new Intl.DateTimeFormat("tr-TR", { timeZone: APP_TZ, dateStyle: "full" }).format(today)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Bugünkü gelir" value={formatPrice(dayStats.income)} icon={TrendingUp} tone="positive" />
        <StatCard label="Bugünkü gider" value={formatPrice(dayStats.expense)} icon={TrendingDown} tone="negative" />
        <StatCard
          label="Bugünkü kâr"
          value={formatPrice(dayStats.profit)}
          icon={Wallet}
          tone={dayStats.profit >= 0 ? "positive" : "negative"}
        />
        <StatCard
          label="Tamamlanan sipariş"
          value={String(dayStats.orderCount)}
          icon={Receipt}
          hint={`${activeOrders} aktif sipariş`}
        />
      </div>

      {debt.total > 0 && (
        <Card className={debt.overdue.length > 0 ? "border-rose-200 bg-rose-50/50" : undefined}>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2">
              <HandCoins className="h-4 w-4" />
              Ödenmemiş tedarikçi borcu
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/yonetim/finans/tedarikciler">
                Tedarikçiler <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums text-rose-700">{formatPrice(debt.total)}</p>
            {debt.overdue.length > 0 && (
              <p className="mt-1 flex items-center gap-1 text-sm text-rose-700">
                <AlertCircle className="h-4 w-4" />
                {debt.overdue.length} kalemin vadesi geçti
              </p>
            )}
            <ul className="mt-3 divide-y">
              {debt.items.slice(0, 4).map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.supplierName ?? "Tedarikçisiz"}
                      {item.dueDate ? ` · vade ${formatDate(item.dueDate)}` : " · vade yok"}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">{formatPrice(item.remaining)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Son 7 gün</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link href="/yonetim/finans">
              Finans <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <FinanceChart data={series} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Bu ay</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Gelir" value={formatPrice(monthStats.income)} className="text-emerald-700" />
            <Row label="Gider" value={formatPrice(monthStats.expense)} className="text-rose-700" />
            <Row label="Net kâr" value={formatPrice(monthStats.profit)} bold />
            <Row
              label="Kâr marjı"
              value={
                monthStats.income > 0
                  ? `%${((monthStats.profit / monthStats.income) * 100).toFixed(1)}`
                  : "—"
              }
            />
            <Row label="Tamamlanan sipariş" value={String(monthStats.orderCount)} />
            <Row
              label="Ortalama sepet"
              value={
                monthStats.orderCount > 0
                  ? formatPrice(monthStats.income / monthStats.orderCount)
                  : "—"
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>En çok satanlar (bu ay)</CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Henüz satış yok.</p>
            ) : (
              <ul className="space-y-2.5">
                {topProducts.map((p, i) => (
                  <li key={p.name} className="flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-bold">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.quantity} adet</p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">{formatPrice(p.revenue)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Son siparişler</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link href="/yonetim/siparisler">
              Tümü <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              <Coffee className="mx-auto mb-2 h-6 w-6" />
              Henüz sipariş yok.
            </p>
          ) : (
            <ul className="divide-y">
              {recentOrders.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      Masa {o.tableNo} · #{o.orderNo}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatTime(o.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={ORDER_STATUS_CLASS[o.status]}>
                      {ORDER_STATUS_LABEL[o.status]}
                    </Badge>
                    <span className="text-sm font-semibold tabular-nums">{formatPrice(o.totalAmount)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({
  label,
  value,
  className,
  bold,
}: {
  label: string;
  value: string;
  className?: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${bold ? "font-bold" : "font-medium"} ${className ?? ""}`}>{value}</span>
    </div>
  );
}
