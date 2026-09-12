import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guards";
import { StaffManager, type StaffRow } from "@/components/admin/staff-manager";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Personel" };

type UserWithCount = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: "ADMIN" | "STAFF";
  isActive: boolean;
  createdAt: Date;
  _count: { ordersTaken: number };
};

export default async function PersonelPage() {
  const me = await requireUser(["ADMIN"]);

  const users = (await prisma.user.findMany({
    orderBy: [{ isActive: "desc" }, { role: "asc" }, { name: "asc" }],
    include: { _count: { select: { ordersTaken: true } } },
  })) as UserWithCount[];

  const rows: StaffRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    isActive: u.isActive,
    createdAt: u.createdAt.toISOString(),
    orderCount: u._count.ordersTaken,
  }));

  return <StaffManager users={rows} currentUserId={me.id} />;
}
