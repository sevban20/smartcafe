import Link from "next/link";
import { AlertTriangle, Ban, Package, Trash2 } from "lucide-react";
import { getCancelReport, resolvePeriod } from "@/lib/stats";
import { StatCard } from "@/components/admin/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CANCEL_REASON_LABEL } from "@/lib/constants";
import { cn, formatDate, formatPrice, formatTime } from "@/lib/utils";
import type { CancelReason } from "@prisma/client";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "İptaller" };

const PERIODS = [
  { key: "buay", label: "Bu ay" },
  { key: "gecenay", label: "Geçen ay" },
  { key: "son3ay", label: "Son 3 ay" },
  { key: "buyil", label: "Bu yıl" },
  { key: "tumu", label: "Tümü" },
];

const reasonLabel = (r: string | null) =>
  r && r in CANCEL_REASON_LABEL ? CANCEL_REASON_LABEL[r as CancelReason] : "Belirtilmedi";

export default async function IptallerPage({ searchParams }: { searchParams: { donem?: string } }) {
  const period = resolvePeriod(searchParams.donem);
  const report = await getCancelReport(period.from, period.to);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">İptaller</h1>
        <p className="text-sm text-muted-foreground">
          Kim, neyi, neden iptal etti — {period.label.toLowerCase()}
        </p>
      </div>

      <nav className="no-scrollbar flex gap-2 overflow-x-auto">
        {PERIODS.map((p) => (
          <Link
            key={p.key}
            href={`/yonetim/iptaller?donem=${p.key}`}
            className={cn(
              "whitespace-nowrap rounded-full border px-3 py-1 text-xs transition-colors",
              period.key === p.key ? "border-foreground bg-foreground text-background" : "text-muted-foreground"
            )}
          >
            {p.label}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="İptal edilen tutar"
          value={formatPrice(report.totalAmount)}
          icon={Ban}
          tone={report.totalAmount > 0 ? "negative" : "default"}
        />
        <StatCard
          label="Fire / zayi"
          value={formatPrice(report.wasteAmount)}
          icon={Trash2}
          tone={report.wasteAmount > 0 ? "negative" : "default"}
          hint="Hazırlandı, maliyet oluştu"
        />
        <StatCard label="İptal edilen kalem" value={String(report.itemCount)} icon={Package} />
        <StatCard
          label="Etkilenen sipariş"
          value={String(report.orderCount)}
          icon={AlertTriangle}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Nedene göre</CardTitle>
          </CardHeader>
          <CardContent>
            {report.byReason.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Bu dönemde iptal yok.</p>
            ) : (
              <ul className="space-y-2">
                {report.byReason.map((r) => (
                  <li key={r.reason} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2">
                      {reasonLabel(r.reason)}
                      {r.reason === "FIRE" && (
                        <Badge variant="outline" className="border-rose-200 bg-rose-100 text-[10px] text-rose-800">
                          zayi
                        </Badge>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">{r.count} kalem</span>
                    <span className="font-semibold tabular-nums">{formatPrice(r.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kişiye göre</CardTitle>
          </CardHeader>
          <CardContent>
            {report.byUser.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Bu dönemde iptal yok.</p>
            ) : (
              <ul className="space-y-2">
                {report.byUser.map((u) => (
                  <li key={u.name} className="flex items-center justify-between gap-3 text-sm">
                    <span>{u.name}</span>
                    <span className="text-xs text-muted-foreground">{u.count} kalem</span>
                    <span className="font-semibold tabular-nums">{formatPrice(u.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>İptal dökümü</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {report.rows.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Bu dönemde iptal kaydı yok.</p>
          ) : (
            <ul className="divide-y">
              {report.rows.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-[12rem] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">
                        {row.quantity}× {row.productName}
                      </p>
                      <Badge
                        variant="outline"
                        className={
                          row.reason === "FIRE"
                            ? "border-rose-200 bg-rose-100 text-[10px] text-rose-800"
                            : "text-[10px]"
                        }
                      >
                        {reasonLabel(row.reason)}
                      </Badge>
                      {row.wholeOrder && (
                        <Badge variant="secondary" className="text-[10px]">
                          Sipariş komple iptal
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Masa {row.tableNo} · #{row.orderNo} · {formatDate(row.at)} {formatTime(row.at)}
                      {row.by ? ` · ${row.by}` : ""}
                      {row.note ? ` · ${row.note}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-rose-700">
                    −{formatPrice(row.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
