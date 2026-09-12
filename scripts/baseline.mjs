/**
 * `prisma db push` ile olusturulmus mevcut bir veritabanini migration duzenine gecirir.
 * Tek seferlik calistirilir; veriye dokunmaz.
 *
 *   npm run db:baseline
 *
 * Sonrasinda sema degisikliklerini `npm run db:migrate -- --name aciklama` ile yap,
 * yayina alirken de `npm run db:deploy` calistir.
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

const DIR = "prisma/migrations/0_init";

if (existsSync(DIR)) {
  console.log("Baseline zaten olusturulmus (prisma/migrations/0_init). Bir sey yapilmadi.");
  process.exit(0);
}

console.log("Mevcut semadan baslangic migration'i uretiliyor...");
const sql = execSync(
  "npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script",
  { encoding: "utf8" }
);

mkdirSync(DIR, { recursive: true });
writeFileSync(`${DIR}/migration.sql`, sql);
console.log(`Yazildi: ${DIR}/migration.sql`);

console.log("Veritabaninda 'uygulanmis' olarak isaretleniyor...");
execSync("npx prisma migrate resolve --applied 0_init", { stdio: "inherit" });

console.log("\nTamam. Artik sema degisikliklerini su sekilde yap:");
console.log("  npm run db:migrate -- --name yeni_alan");
console.log("Yayina alirken (Vercel build komutunda):");
console.log("  npm run db:deploy");
