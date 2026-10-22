import { redirect } from "next/navigation";
import { getLocations } from "@/lib/data/locations";
import { getBookingsForDay } from "@/lib/data/bookings";
import { getDiscountRules } from "@/lib/data/discount-rules";
import { getActivePricingRules } from "@/lib/data/pricing-rules";
import { getPreferredCustomers } from "@/lib/actions/preferred-customers";
import { getKolBookings } from "@/lib/actions/kol-bookings";
import { getCurrentUser } from "@/lib/data/current-user";
import { hasModulePermission, firstPermittedPath, canEdit } from "@/lib/permissions";
import FloorMapGrid from "@/components/FloorMapGrid";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default async function FloorMapPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasModulePermission(user.role, user.permissions, "floor_map")) {
    redirect(firstPermittedPath(user.permissions) ?? "/no-access");
  }

  const canSeeKol = hasModulePermission(user.role, user.permissions, "kol");
  const canSeeCheckin = hasModulePermission(user.role, user.permissions, "checkin");
  const today = todayStr();

  const [locations, bookings, discountRules, pricingRules, preferredCustomers, todaysKolBookings] =
    await Promise.all([
      getLocations(),
      getBookingsForDay(),
      getDiscountRules(),
      getActivePricingRules(),
      getPreferredCustomers(),
      canSeeKol ? getKolBookings({ dateFrom: today, dateTo: today }) : Promise.resolve([]),
    ]);
  const todaysKol = todaysKolBookings.filter((k) => k.status !== "hủy");

  return (
    <div>
      <h1 className="mb-3 text-2xl font-bold text-brand-forest">
        Bản đồ mặt bằng
      </h1>
      <FloorMapGrid
        locations={locations}
        bookings={bookings}
        discountRules={discountRules}
        pricingRules={pricingRules}
        preferredCustomers={preferredCustomers}
        canEdit={canEdit(user.role, user.view_only)}
        isAdmin={user.role === "admin"}
        todaysKol={canSeeKol ? todaysKol : null}
        canSeeCheckin={canSeeCheckin}
      />
    </div>
  );
}
