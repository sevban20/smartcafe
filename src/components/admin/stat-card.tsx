import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  hint,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: "default" | "positive" | "negative";
  hint?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Icon
          className={cn(
            "h-4 w-4 shrink-0",
            tone === "positive" && "text-emerald-600",
            tone === "negative" && "text-rose-600",
            tone === "default" && "text-muted-foreground"
          )}
        />
      </div>
      <p
        className={cn(
          "mt-2 text-xl font-bold tabular-nums",
          tone === "positive" && "text-emerald-700",
          tone === "negative" && "text-rose-700"
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </Card>
  );
}
