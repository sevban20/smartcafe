import { prisma } from "@/lib/prisma";
import type { CategoryDTO, ProductDTO } from "@/types/menu";

const productInclude = {
  where: { isAvailable: true },
  orderBy: [{ sortOrder: "asc" as const }, { name: "asc" as const }],
  include: {
    options: {
      orderBy: { sortOrder: "asc" as const },
      include: { choices: { orderBy: { sortOrder: "asc" as const } } },
    },
  },
};

type ProductRec = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  options: {
    id: string;
    name: string;
    isRequired: boolean;
    isMultiple: boolean;
    choices: { id: string; name: string; extraPrice: number }[];
  }[];
};

type CategoryRec = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  parentId: string | null;
  products: ProductRec[];
};

const toProduct = (p: ProductRec): ProductDTO => ({
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
});

/**
 * Musteri ve garson menusu icin kategori agaci: ust kategoriler, altlarinda
 * alt kategoriler. Satista urunu olmayan (alt) kategoriler gizlenir.
 */
export async function getMenuCategories(): Promise<CategoryDTO[]> {
  const all = (await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      imageUrl: true,
      parentId: true,
      products: productInclude,
    },
  })) as CategoryRec[];

  const childrenOf = new Map<string, CategoryRec[]>();
  for (const c of all) {
    if (!c.parentId) continue;
    const list = childrenOf.get(c.parentId) ?? [];
    list.push(c);
    childrenOf.set(c.parentId, list);
  }

  const result: CategoryDTO[] = [];
  for (const top of all.filter((c) => !c.parentId)) {
    const children = (childrenOf.get(top.id) ?? [])
      .filter((c) => c.products.length > 0)
      .map<CategoryDTO>((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        imageUrl: c.imageUrl ?? c.products.find((p) => p.imageUrl)?.imageUrl ?? null,
        products: c.products.map(toProduct),
        children: [],
      }));
    if (top.products.length === 0 && children.length === 0) continue;

    // Kategori gorseli yoksa ilk urun fotografi kullanilir, kartlar bos kalmasin
    const fallbackImage =
      top.products.find((p) => p.imageUrl)?.imageUrl ??
      children.find((c) => c.imageUrl)?.imageUrl ??
      null;

    result.push({
      id: top.id,
      name: top.name,
      description: top.description,
      imageUrl: top.imageUrl ?? fallbackImage,
      products: top.products.map(toProduct),
      children,
    });
  }
  return result;
}
