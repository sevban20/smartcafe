import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import type { Role } from "@prisma/client";

// Uretimde NEXTAUTH_SECRET yoksa sessizce bozulmak yerine acikca patla.
// DIKKAT: `next build` sayfa verilerini toplarken bu modulu NODE_ENV=production
// ile yukler ama ortamda secret bulunmaz (ve bulunmamali — imaj katmanina sizar).
// Bu yuzden derleme asamasi haric tutuluyor; calisma anindaki kontrol gecerli.
const derlemeAsamasi = process.env.NEXT_PHASE === "phase-production-build";

if (!derlemeAsamasi && process.env.NODE_ENV === "production" && !process.env.NEXTAUTH_SECRET) {
  throw new Error(
    "NEXTAUTH_SECRET tanimli degil. Uretimde bu olmadan oturumlar dogrulanamaz. " +
      "Uretmek icin: openssl rand -base64 32"
  );
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/giris" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "E-posta", type: "email" },
        password: { label: "Şifre", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        const email = credentials.email.toLowerCase().trim();

        // Kaba kuvvet denemelerini yavaslatir: 15 dakikada en fazla 30 deneme.
        // Sinir asilirsa terminale yaziyoruz ki "sifre yanlis" saniligi olmasin.
        if (!rateLimit(`giris:${email}`, 30, 15 * 60_000).ok) {
          console.warn(
            `[giris] "${email}" icin cok fazla deneme yapildi, gecici olarak engellendi. ` +
              "Sunucuyu yeniden baslatmak sayaci sifirlar."
          );
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.isActive) return null;
        const ok = await bcrypt.compare(credentials.password, user.password);
        if (!ok) return null;
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id;
        token.role = (user as { role: Role }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,

  // Gelistirmede site http://localhost uzerinden acilir. NEXTAUTH_URL yanlislikla
  // https ile yazilirsa NextAuth cerezi "Secure" bayragiyla uretir, tarayici da
  // http'de Secure cerezi saklamaz — giris basarili gorunur ama oturum acilmaz.
  // Bunu ortam degiskenine birakmayip acikca belirliyoruz.
  useSecureCookies: process.env.NODE_ENV === "production",

  // Ayrintili gunluk gerekirse .env'e NEXTAUTH_DEBUG="1" ekleyip sunucuyu yeniden baslatin
  debug: process.env.NEXTAUTH_DEBUG === "1",
};
