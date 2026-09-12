import { requireUser } from "@/lib/guards";
import { AdminShell } from "@/components/admin/admin-shell";

export const dynamic = "force-dynamic";

export default async function YonetimLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["ADMIN"]);
  return <AdminShell userName={user.name ?? "Yönetici"}>{children}</AdminShell>;
}
