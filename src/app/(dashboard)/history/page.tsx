import { redirect } from "next/navigation";
import { getLocations } from "@/lib/data/locations";
import { getCurrentUser } from "@/lib/data/current-user";
import { hasModulePermission, firstPermittedPath } from "@/lib/permissions";
import HistoryClient from "./HistoryClient";

export default async function HistoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasModulePermission(user.role, user.permissions, "history")) {
    redirect(firstPermittedPath(user.permissions) ?? "/no-access");
  }

  const locations = await getLocations();

  return (
    <div>
      <h1 className="mb-3 text-2xl font-bold text-brand-forest">Lịch sử đặt chỗ</h1>
      <HistoryClient locations={locations} />
    </div>
  );
}
