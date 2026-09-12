/**
 * Giris sorunlarini teshis eder. Hicbir seyi degistirmez.
 *
 *   npm run check:giris
 *   npm run check:giris -- admin@smartcafe.local sifreniz    (sifreyi de dogrular)
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const [emailArg, passwordArg] = process.argv.slice(2);

function durum(ok: boolean) {
  return ok ? "TAMAM" : "EKSIK";
}

async function main() {
  console.log("\n=== 1. ORTAM DEGISKENLERI ===");
  const secret = process.env.NEXTAUTH_SECRET;
  const url = process.env.NEXTAUTH_URL;
  const db = process.env.DATABASE_URL;

  console.log(`DATABASE_URL      : ${durum(Boolean(db))}`);
  console.log(
    `NEXTAUTH_SECRET   : ${durum(Boolean(secret && secret.length >= 16))}` +
      (secret ? ` (${secret.length} karakter)` : "")
  );
  console.log(`NEXTAUTH_URL      : ${url ?? "TANIMSIZ"}`);

  if (!secret) {
    console.log("\n  >>> EN OLASI SEBEP BU. NEXTAUTH_SECRET yoksa oturum cerezi");
    console.log("      dogrulanamaz ve giristen sonra tekrar giris ekranina donersiniz.");
    console.log("      Uretmek icin: openssl rand -base64 32");
  } else if (secret.length < 16) {
    console.log("\n  >>> NEXTAUTH_SECRET cok kisa. openssl rand -base64 32 ile yenisini uretin.");
  }
  if (url && !/^https?:\/\//.test(url)) {
    console.log("\n  >>> NEXTAUTH_URL http:// veya https:// ile baslamali.");
  }
  if (url) {
    console.log(
      `\n  NOT: Tarayicida tam olarak "${url}" adresini acmalisiniz.` +
        "\n       localhost yerine 127.0.0.1 veya telefondan 192.168.x.x ile acarsaniz" +
        "\n       cerez o adrese yazilmaz ve giris tutmaz."
    );
  }

  console.log("\n=== 2. KULLANICILAR ===");
  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { email: "asc" }],
    select: { email: true, name: true, role: true, isActive: true },
  });

  if (users.length === 0) {
    console.log("HIC KULLANICI YOK. Cozum: npm run db:seed");
  } else {
    for (const u of users) {
      console.log(
        `${u.isActive ? "[aktif] " : "[PASIF] "}${u.email.padEnd(30)} ${u.role.padEnd(6)} ${u.name}`
      );
    }
    if (!users.some((u) => u.role === "ADMIN" && u.isActive)) {
      console.log("\n  >>> Aktif YONETICI yok. Cozum: npm run db:seed");
    }
  }

  console.log("\n=== 3. SIFRE DOGRULAMA ===");
  if (!emailArg || !passwordArg) {
    console.log("Atlandi. Denemek icin: npm run check:giris -- e-posta sifre");
  } else {
    const user = await prisma.user.findUnique({ where: { email: emailArg.toLowerCase().trim() } });
    if (!user) {
      console.log(`"${emailArg}" bulunamadi. Yukaridaki listeden dogru e-postayi kullanin.`);
    } else if (!user.isActive) {
      console.log(`"${emailArg}" PASIF durumda, giris yapamaz.`);
    } else {
      const ok = await bcrypt.compare(passwordArg, user.password);
      console.log(ok ? "Sifre DOGRU. Sorun sifrede degil." : "Sifre YANLIS.");
      if (!ok) console.log("  Sifreyi sifirlamak icin: npm run db:seed (varsayilanlari geri yazar)");
    }
  }

  console.log("");
}

main()
  .catch((e) => {
    console.error("\nVeritabanina baglanilamadi ya da tablolar eksik:");
    console.error(e instanceof Error ? e.message : e);
    console.error("\nCozum denemesi: npm run db:push && npm run db:seed");
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
