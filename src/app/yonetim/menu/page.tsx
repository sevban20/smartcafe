import { prisma } from "@/lib/prisma";
import { MenuManager, type AdminCategory } from "@/components/admin/menu-manager";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Menü Yönetimi" };

export default async function AdminMenuPage() {
  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      products: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: {
          options: {
            orderBy: { sortOrder: "asc" },
            include: { choices: { orderBy: { sortOrder: "asc" } } },
          },
        },
      },
    },
  });

  const data: AdminCategory[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    sortOrder: c.sortOrder,
    products: c.products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price,
      imageUrl: p.imageUrl,
      isAvailable: p.isAvailable,
      sortOrder: p.sortOrder,
      options: p.options.map((o) => ({
        name: o.name,
        isRequired: o.isRequired,
        isMultiple: o.isMultiple,
        choices: o.choices.map((ch) => ({ name: ch.name, extraPrice: ch.extraPrice })),
      })),
    })),
  }));

  return <MenuManager categories={data} />;
}
