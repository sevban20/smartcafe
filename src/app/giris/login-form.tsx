"use client";

import * as React from "react";
import { getSession, signIn } from "next-auth/react";
import { Coffee, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginForm({ yetkiHatasi, devam }: { yetkiHatasi?: boolean; devam?: string }) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(
    yetkiHatasi ? "Bu sayfa için yetkiniz yok." : null
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await signIn("credentials", { email, password, redirect: false });

    if (res?.error) {
      setLoading(false);
      setError("E-posta veya şifre hatalı.");
      return;
    }

    // Oturum çerezi yeni yazıldı. Next'in istemci taraflı yönlendirici önbelleği
    // giriş ÖNCESİ (çıkış yapılmış) sayfaları tutuyor; router.replace ile yumuşak
    // geçiş yapılırsa o bayat sürüm gösterilir ve kullanıcı giriş yapamamış görünür.
    // Bu yüzden tam sayfa geçişi yapıyoruz: her şey sunucudan, yeni çerezle gelir.
    const session = await getSession();
    const hedef = devam ?? (session?.user?.role === "ADMIN" ? "/yonetim" : "/kds");
    window.location.assign(hedef);
    // setLoading(false) YOK — sayfa değişene kadar düğme "giriş yapılıyor" kalsın
  };

  return (
    <main className="flex min-h-[100dvh] items-center justify-center p-5 safe-top safe-bottom">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Coffee className="h-7 w-7" />
          </div>
          <CardTitle className="text-xl">SmartCafe OS</CardTitle>
          <CardDescription>Yönetici ve personel girişi</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-posta</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@kafe.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Şifre</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            {error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Giriş Yap"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
