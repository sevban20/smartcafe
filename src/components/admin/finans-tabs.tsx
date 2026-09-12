"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/yonetim/finans", label: "Hareketler" },
  { href: "/yonetim/finans/tedarikciler", label: "Tedarikçiler" },
  { href: "/yonetim/finans/kalemler", label: "Gider Kalemleri" },
];

export function FinansTabs() {
  const pathname = usePathname();

  return (
    <nav className="no-scrollbar flex gap-2 overflow-x-auto">
      {TABS.map((tab) => {
        const active = tab.href === "/yonetim/finans" ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm transition-colors",
              active ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
