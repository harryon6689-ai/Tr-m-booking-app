import { redirect } from "next/navigation";
import { getLocations } from "@/lib/data/locations";
import { getFixedCustomers } from "@/lib/actions/fixed-customers";
import { getCurrentUser } from "@/lib/data/current-user";
import { hasModulePermission, firstPermittedPath } from "@/lib/permissions";
import FixedCustomersClient from "./FixedCustomersClient";

export default async function FixedCustomersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasModulePermission(user.role, user.permissions, "fixed_customers")) {
    redirect(firstPermittedPath(user.permissions) ?? "/no-access");
  }

  const [locations, fixedCustomers] = await Promise.all([
    getLocations(),
    getFixedCustomers(),
  ]);

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-brand-forest">Khách cố định</h1>
      <p className="mb-3 text-sm text-brand-forest/60">
        Lịch đặt lặp lại của khách quen — hệ thống sẽ tự chặn các đặt chỗ khác trùng
        giờ với lịch cố định này.
      </p>
      <FixedCustomersClient
        locations={locations}
        fixedCustomers={fixedCustomers}
        isAdmin={user.role === "admin"}
      />
    </div>
  );
}
