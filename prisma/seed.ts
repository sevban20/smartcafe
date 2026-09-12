import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // --- Kullanicilar ---
  const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@smartcafe.local").toLowerCase();
  const staffEmail = (process.env.STAFF_EMAIL ?? "barista@smartcafe.local").toLowerCase();

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: process.env.ADMIN_NAME ?? "Kafe Sahibi",
      email: adminEmail,
      password: await bcrypt.hash(process.env.ADMIN_PASSWORD ?? "admin123", 10),
      role: "ADMIN",
    },
  });

  await prisma.user.upsert({
    where: { email: staffEmail },
    update: {},
    create: {
      name: "Barista",
      email: staffEmail,
      password: await bcrypt.hash(process.env.STAFF_PASSWORD ?? "barista123", 10),
      role: "STAFF",
    },
  });

  // --- Varsayilan gider kalemleri ---
  const defaultExpenseCategories = [
    "Hammadde",
    "Süt ve Süt Ürünleri",
    "Kahve Çekirdeği",
    "Personel",
    "Kira",
    "Fatura",
    "Ekipman",
    "Temizlik",
    "Pazarlama",
    "Diğer",
  ];
  for (let index = 0; index < defaultExpenseCategories.length; index++) {
    const name = defaultExpenseCategories[index];
    await prisma.expenseCategory.upsert({
      where: { name },
      update: {},
      create: { name, sortOrder: index },
    });
  }

  if ((await prisma.product.count()) > 0) {
    console.log("Menu zaten dolu, urun eklenmedi.");
    return;
  }

  // --- Menu ---
  const kahve = await prisma.category.create({ data: { name: "Sıcak Kahveler", sortOrder: 1 } });
  const soguk = await prisma.category.create({ data: { name: "Soğuk İçecekler", sortOrder: 2 } });
  const tatli = await prisma.category.create({ data: { name: "Tatlılar", sortOrder: 3 } });

  const boyut = (extraM: number, extraL: number) => ({
    name: "Boyut",
    isRequired: true,
    isMultiple: false,
    sortOrder: 1,
    choices: {
      create: [
        { name: "Küçük", extraPrice: 0, sortOrder: 1 },
        { name: "Orta", extraPrice: extraM, sortOrder: 2 },
        { name: "Büyük", extraPrice: extraL, sortOrder: 3 },
      ],
    },
  });

  const sut = {
    name: "Süt Tercihi",
    isRequired: true,
    isMultiple: false,
    sortOrder: 2,
    choices: {
      create: [
        { name: "İnek Sütü", extraPrice: 0, sortOrder: 1 },
        { name: "Laktozsuz Süt", extraPrice: 10, sortOrder: 2 },
        { name: "Badem Sütü", extraPrice: 20, sortOrder: 3 },
        { name: "Yulaf Sütü", extraPrice: 20, sortOrder: 4 },
      ],
    },
  };

  const ekstralar = {
    name: "Ekstralar",
    isRequired: false,
    isMultiple: true,
    sortOrder: 3,
    choices: {
      create: [
        { name: "Ekstra Shot", extraPrice: 25, sortOrder: 1 },
        { name: "Karamel Şurup", extraPrice: 15, sortOrder: 2 },
        { name: "Vanilya Şurup", extraPrice: 15, sortOrder: 3 },
        { name: "Fındık Şurup", extraPrice: 15, sortOrder: 4 },
        { name: "Tarçın", extraPrice: 0, sortOrder: 5 },
      ],
    },
  };

  await prisma.product.create({
    data: {
      name: "Latte",
      description: "Espresso ve buharda ısıtılmış süt",
      price: 95,
      categoryId: kahve.id,
      sortOrder: 1,
      options: { create: [boyut(15, 30), sut, ekstralar] },
    },
  });

  await prisma.product.create({
    data: {
      name: "Cappuccino",
      description: "Yoğun süt köpüğüyle klasik espresso",
      price: 95,
      categoryId: kahve.id,
      sortOrder: 2,
      options: { create: [boyut(15, 30), sut, ekstralar] },
    },
  });

  await prisma.product.create({
    data: {
      name: "Filtre Kahve",
      description: "Günün çekirdeğinden demleme",
      price: 80,
      categoryId: kahve.id,
      sortOrder: 3,
      options: { create: [boyut(10, 20)] },
    },
  });

  await prisma.product.create({
    data: {
      name: "Espresso",
      description: "Tek shot yoğun espresso",
      price: 65,
      categoryId: kahve.id,
      sortOrder: 4,
      options: {
        create: [
          {
            name: "Shot Sayısı",
            isRequired: true,
            isMultiple: false,
            sortOrder: 1,
            choices: { create: [{ name: "Tek", extraPrice: 0, sortOrder: 1 }, { name: "Double", extraPrice: 25, sortOrder: 2 }] },
          },
        ],
      },
    },
  });

  await prisma.product.create({
    data: {
      name: "Ice Latte",
      description: "Buz üzerine espresso ve soğuk süt",
      price: 105,
      categoryId: soguk.id,
      sortOrder: 1,
      options: { create: [boyut(15, 30), sut, ekstralar] },
    },
  });

  await prisma.product.create({
    data: {
      name: "Limonata",
      description: "Taze sıkılmış, naneli",
      price: 85,
      categoryId: soguk.id,
      sortOrder: 2,
      options: { create: [boyut(0, 20)] },
    },
  });

  await prisma.product.create({
    data: {
      name: "San Sebastian Cheesecake",
      description: "Dilim",
      price: 145,
      categoryId: tatli.id,
      sortOrder: 1,
      options: {
        create: [
          {
            name: "Yanında",
            isRequired: false,
            isMultiple: true,
            sortOrder: 1,
            choices: { create: [{ name: "Frambuaz Sos", extraPrice: 20, sortOrder: 1 }, { name: "Dondurma Topu", extraPrice: 35, sortOrder: 2 }] },
          },
        ],
      },
    },
  });

  await prisma.product.create({
    data: {
      name: "Brownie",
      description: "Sıcak servis edilir",
      price: 120,
      categoryId: tatli.id,
      sortOrder: 2,
    },
  });

  console.log("Seed tamamlandi.");
  console.log(`Yonetici: ${adminEmail} / ${process.env.ADMIN_PASSWORD ?? "admin123"}`);
  console.log(`Personel: ${staffEmail} / ${process.env.STAFF_PASSWORD ?? "barista123"}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
