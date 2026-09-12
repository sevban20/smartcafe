import { prisma } from "@/lib/prisma";
import { MenuClient } from "@/components/menu/menu-client";
import type { CategoryDTO } from "@/types/menu";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Menü" };

export default async function MenuPage({ params }: { params: { tableNo: string } }) {
  const tableNo = decodeURIComponent(params.tableNo);

  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      products: {
        where: { isAvailable: true },
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

  const data: CategoryDTO[] = categories
    .filter((c) => c.products.length > 0)
    .map((c) => ({
      id: c.id,
      name: c.name,
      products: c.products.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        imageUrl: p.imageUrl,
        isAvailable: p.isAvailable,
        options: p.options.map((o) => ({
          id: o.id,
          name: o.name,
          isRequired: o.isRequired,
          isMultiple: o.isMultiple,
          choices: o.choices.map((ch) => ({ id: ch.id, name: ch.name, extraPrice: ch.extraPrice })),
        })),
      })),
    }));

  return <MenuClient tableNo={tableNo} categories={data} />;
}
