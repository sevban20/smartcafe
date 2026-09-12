import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import type { Role } from "@prisma/client";

/**
 * Korumali sayfalarda kullanilir. Oturum yoksa girise, rolu yetmiyorsa
 * kullanicinin kendi ekranina yonlendirir.
 *
 * Not: Yetkilendirme bilerek middleware'de degil burada yapiliyor —
 * Edge calisma ortamindaki token dogrulamasi sayfa katmaniyla ayrisip
 * sessiz yonlendirme donguleri uretebiliyor.
 */
export async function requireUser(roles?: Role[]) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/giris");

  if (roles && !roles.includes(session.user.role)) {
    redirect(session.user.role === "ADMIN" ? "/yonetim" : "/kds?hata=yetki");
  }

  return session.user;
}

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  return session?.user ?? null;
}
