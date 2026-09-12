"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CategorySlice } from "@/lib/stats";
import { formatPrice } from "@/lib/utils";

const COLORS = ["#b45309", "#0f766e", "#4338ca", "#be123c", "#a16207", "#0369a1", "#6d28d9", "#65a30d"];

export function ExpenseBreakdownChart({ data }: { data: CategorySlice[] }) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Bu dönemde gider kaydı yok.</p>;
  }

  const total = data.reduce((sum, d) => sum + d.amount, 0);

  return (
    <div className="space-y-4">
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(30 18% 88%)" />
            <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} fontSize={11} width={90} />
            <Tooltip
              formatter={(value: number) => formatPrice(value)}
              contentStyle={{ borderRadius: 12, border: "1px solid hsl(30 18% 88%)", fontSize: 12 }}
            />
            <Bar dataKey="amount" name="Gider" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <ul className="space-y-1.5">
        {data.map((slice, index) => (
          <li key={slice.name} className="flex items-center gap-2 text-sm">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
            <span className="min-w-0 flex-1 truncate">{slice.name}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              %{total > 0 ? ((slice.amount / total) * 100).toFixed(0) : 0}
            </span>
            <span className="font-medium tabular-nums">{formatPrice(slice.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
