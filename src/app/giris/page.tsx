import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/guards";
import { LoginForm } from "@/app/giris/login-form";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Giriş" };

export default async function GirisPage({
  searchParams,
}: {
  searchParams: { hata?: string; devam?: string };
}) {
  const user = await getCurrentUser();
  if (user && !searchParams.hata) {
    redirect(user.role === "ADMIN" ? "/yonetim" : "/kds");
  }

  return <LoginForm yetkiHatasi={searchParams.hata === "yetki"} devam={searchParams.devam} />;
}
