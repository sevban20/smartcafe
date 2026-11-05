"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/menu/menu-parts";
import type { SiteSettingsDTO } from "@/lib/site-settings";

/** QR'siz giris: masa numarasini sorup menuye yonlendirir. */
export function TableEntry({ settings }: { settings: SiteSettingsDTO }) {
  const router = useRouter();
  const [tableNo, setTableNo] = React.useState("");

  return (
    <main className="flex min-h-[100dvh] flex-col">
      <div className="safe-top flex flex-1 flex-col items-center justify-center gap-3 bg-[var(--brand)] px-6 py-12 text-center text-[var(--brand-fg)]">
        <BrandMark settings={settings} className="h-16 max-w-[220px]" textClassName="text-3xl" />
        {settings.tagline && <p className="text-[11px] uppercase tracking-[0.35em] opacity-75">{settings.tagline}</p>}
      </div>

      <form
        className="safe-bottom mx-auto w-full max-w-xs space-y-3 px-6 py-10"
        onSubmit={(e) => {
          e.preventDefault();
          const t = tableNo.trim();
          if (t) router.push(`/menu/${encodeURIComponent(t)}`);
        }}
      >
        <p className="text-center text-sm text-muted-foreground">Sipariş vermek için masa numaranızı girin.</p>
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
