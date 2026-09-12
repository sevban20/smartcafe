/**
 * Bir kullanicinin sifresini sifirlar; kullanici yoksa olusturur.
 *
 *   npm run db:sifre -- admin@kafem.com yeniSifre
 *   npm run db:sifre -- admin@kafem.com yeniSifre STAFF     (rol istege bagli, varsayilan ADMIN)
 *
 * Docker'da:
 *   docker compose --profile tools run --rm tools npm run db:sifre -- admin@kafem.com yeniSifre
 *
 * Not: db:seed mevcut kullanicilari DEGISTIRMEZ (upsert update bos birakildi),
 * bu yuzden sifre degistirmek icin bu komut var.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const [emailArg, passwordArg, roleArg] = process.argv.slice(2);

async function main() {
  if (!emailArg || !passwordArg) {
    console.log("Kullanim: npm run db:sifre -- eposta yeniSifre [ADMIN|STAFF]");
    process.exit(1);
  }
  if (passwordArg.length < 6) {
    console.log("Sifre en az 6 karakter olmali.");
    process.exit(1);
  }

  const email = emailArg.toLowerCase().trim();
  const role = roleArg === "STAFF" ? "STAFF" : "ADMIN";
  const hash = await bcrypt.hash(passwordArg, 10);

  const mevcut = await prisma.user.findUnique({ where: { email } });

  if (mevcut) {
    await prisma.user.update({
      where: { email },
      data: { password: hash, isActive: true },
    });
    console.log(`"${email}" sifresi guncellendi. Rol: ${mevcut.role} (degistirilmedi), hesap aktif.`);
  } else {
    await prisma.user.create({
      data: { email, password: hash, name: email.split("@")[0], role },
    });
    console.log(`"${email}" olusturuldu. Rol: ${role}`);
  }

  const hepsi = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { email: "asc" }],
    select: { email: true, role: true, isActive: true },
  });
  console.log("\nSistemdeki kullanicilar:");
  for (const u of hepsi) {
    console.log(`  ${u.isActive ? "[aktif]" : "[PASIF]"} ${u.email.padEnd(30)} ${u.role}`);
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
