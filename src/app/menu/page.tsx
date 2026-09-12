"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Coffee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function MenuGirisPage() {
  const router = useRouter();
  const [tableNo, setTableNo] = React.useState("");

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 p-6 safe-top safe-bottom">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Coffee className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold">SmartCafe</h1>
        <p className="text-sm text-muted-foreground">Sipariş vermek için masa numaranızı girin.</p>
      </div>

      <form
        className="w-full max-w-xs space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const t = tableNo.trim();
          if (t) router.push(`/menu/${encodeURIComponent(t)}`);
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="masa">Masa numarası</Label>
          <Input
            id="masa"
            inputMode="numeric"
            placeholder="Örn. 7"
            value={tableNo}
            onChange={(e) => setTableNo(e.target.value)}
            autoFocus
          />
        </div>
        <Button type="submit" className="w-full" size="lg" disabled={!tableNo.trim()}>
          Menüyü Aç
        </Button>
      </form>
    </main>
  );
}
