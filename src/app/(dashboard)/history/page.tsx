import { redirect } from "next/navigation";
import { getLocations } from "@/lib/data/locations";
import {
  searchBookingHistory,
  getRepeatCustomerStats,
} from "@/lib/actions/booking-history";
import { getCurrentUser } from "@/lib/data/current-user";
import { hasModulePermission, firstPermittedPath } from "@/lib/permissions";
import HistoryClient from "./HistoryClient";

export default async function HistoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasModulePermission(user.role, user.permissions, "history")) {
    redirect(firstPermittedPath(user.permissions) ?? "/no-access");
  }

  const [locations, initialRows, initialRepeatCustomers] = await Promise.all([
    getLocations(),
    searchBookingHistory({}),
    getRepeatCustomerStats(),
  ]);

  return (
    <div>
      <h1 className="mb-3 text-2xl font-bold text-brand-forest">Lịch sử đặt chỗ</h1>
      <HistoryClient
        locations={locations}
        initialRows={initialRows}
        initialRepeatCustomers={initialRepeatCustomers}
      />
    </div>
  );
}
