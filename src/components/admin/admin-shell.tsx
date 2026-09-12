"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  BarChart3,
  Coffee,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  Ban,
  QrCode,
  ReceiptText,
  Users,
  Wallet,
  WalletCards,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NotificationControls, useSoundEnabled } from "@/components/kds/notification-controls";

/** Mobil alt gezinmede gorunen ana ekranlar */
const PRIMARY = [
  { href: "/yonetim", label: "Özet", icon: LayoutDashboard },
  { href: "/yonetim/menu", label: "Menü", icon: Coffee },
  { href: "/yonetim/hesaplar", label: "Hesaplar", icon: WalletCards },
  { href: "/yonetim/siparisler", label: "Siparişler", icon: ReceiptText },
  { href: "/yonetim/finans", label: "Finans", icon: Wallet },
];

/** "Diğer" menusundeki ekranlar */
const SECONDARY = [
  { href: "/yonetim/iptaller", label: "İptaller", icon: Ban },
  { href: "/yonetim/personel", label: "Personel", icon: Users },
  { href: "/yonetim/qr", label: "QR Kodlar", icon: QrCode },
];

export function AdminShell({ children, userName }: { children: React.ReactNode; userName: string }) {
  const pathname = usePathname();
  const { soundOn, toggle: toggleSound } = useSoundEnabled();
  const [moreOpen, setMoreOpen] = React.useState(false);

  const isActive = (href: string) => (href === "/yonetim" ? pathname === href : pathname.startsWith(href));
  const secondaryActive = SECONDARY.some((item) => isActive(item.href));

  return (
    <div className="min-h-[100dvh] bg-background md:flex">
      {/* Masaustu kenar cubugu */}
      <aside className="hidden w-60 shrink-0 border-r p-4 md:flex md:flex-col">
        <div className="mb-6 flex items-center gap-2 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold leading-tight">SmartCafe</p>
            <p className="truncate text-xs text-muted-foreground">{userName}</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1">
          {[...PRIMARY, ...SECONDARY].map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive(href) ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mb-2 flex justify-center">
          <NotificationControls soundOn={soundOn} onToggleSound={toggleSound} />
        </div>
        <Button variant="ghost" className="justify-start" onClick={() => signOut({ callbackUrl: "/giris" })}>
          <LogOut className="h-4 w-4" />
          Çıkış Yap
        </Button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobil ust bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur safe-top md:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight">Yönetim</p>
              <p className="truncate text-xs text-muted-foreground">{userName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationControls soundOn={soundOn} onToggleSound={toggleSound} />
            <Button variant="ghost" size="icon" onClick={() => signOut({ callbackUrl: "/giris" })} aria-label="Çıkış">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 pb-24 md:pb-8">{children}</main>

        {/* Mobil alt gezinme */}
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t bg-background/95 backdrop-blur safe-bottom md:hidden">
          {PRIMARY.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium",
                isActive(href) ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
          <button
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium",
              secondaryActive ? "text-primary" : "text-muted-foreground"
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            Diğer
          </button>
        </nav>
      </div>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Diğer</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            {SECONDARY.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMoreOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-3 py-3 text-sm font-medium",
                  isActive(href) ? "border-primary bg-accent/40" : ""
                )}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
