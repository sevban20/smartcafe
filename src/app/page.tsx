import Link from "next/link";
import { Coffee, LayoutDashboard, QrCode, Soup } from "lucide-react";
import { getCurrentUser } from "@/lib/guards";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-8 p-6 safe-top safe-bottom">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Coffee className="h-8 w-8" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">SmartCafe OS</h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          Kafe yönetimi, QR menü, sipariş takibi ve gelir–gider kontrolü tek uygulamada.
        </p>
      </div>

      <div className="grid w-full max-w-xs gap-3">
        <Button asChild size="lg" className="w-full">
          <Link href="/menu">
            <QrCode className="h-5 w-5" />
            Müşteri Menüsü
          </Link>
        </Button>

        {user ? (
          <>
            <Button asChild size="lg" variant="outline" className="w-full">
              <Link href="/kds">
                <Soup className="h-5 w-5" />
                Sipariş Ekranı (KDS)
              </Link>
            </Button>
            {user.role === "ADMIN" && (
              <Button asChild size="lg" variant="outline" className="w-full">
                <Link href="/yonetim">
                  <LayoutDashboard className="h-5 w-5" />
                  Yönetim Paneli
                </Link>
              </Button>
            )}
          </>
        ) : (
          <Button asChild size="lg" variant="outline" className="w-full">
            <Link href="/giris">Personel Girişi</Link>
          </Button>
        )}
      </div>
    </main>
  );
}
