"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftRight, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatPrice } from "@/lib/utils";

type Transfer = {
  id: string;
  fromTable: string;
  toTable: string;
  orderCount: number;
  amount: number;
  merged: boolean;
  partial: boolean;
  note: string | null;
  createdAt: string;
  user: { name: string } | null;
};

const dt = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** Denetim izi: hangi masa ne zaman, kim tarafindan nereye tasindi. */
export function TableTransfers() {
  const { data, isLoading } = useQuery({
    queryKey: ["masa-aktarimlari"],
    queryFn: async () => {
      const res = await fetch("/api/hesaplar/aktar", { cache: "no-store" });
      if (!res.ok) throw new Error("Aktarım geçmişi alınamadı");
      return (await res.json()) as { transfers: Transfer[] };
    },
    refetchInterval: 60_000,
  });

  const transfers = data?.transfers ?? [];

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-bold">Son masa aktarımları</h2>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : transfers.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Henüz masa aktarımı yapılmadı.</p>
      ) : (
        <ul className="mt-3 divide-y text-sm">
          {transfers.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="font-medium">
                  Masa {t.fromTable} <span className="text-muted-foreground">→</span> Masa {t.toTable}
                  {t.merged && (
                    <span className="ml-2 rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900">
                      birleştirildi
                    </span>
                  )}
                  {t.partial && (
                    <span className="ml-2 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                      kısmi
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {dt.format(new Date(t.createdAt))} · {t.orderCount} sipariş
                  {t.user ? ` · ${t.user.name}` : ""}
                  {t.note ? ` · ${t.note}` : ""}
                </p>
              </div>
              <span className="shrink-0 tabular-nums">{formatPrice(t.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
