import { redirect } from "next/navigation";
import { getLocations } from "@/lib/data/locations";
import { getBookingsForDay } from "@/lib/data/bookings";
import { getDiscountRules } from "@/lib/data/discount-rules";
import { getActivePricingRules } from "@/lib/data/pricing-rules";
import { getPreferredCustomers } from "@/lib/actions/preferred-customers";
import { getCurrentUser } from "@/lib/data/current-user";
import { hasModulePermission, firstPermittedPath, canEdit } from "@/lib/permissions";
import FloorMapGrid from "@/components/FloorMapGrid";

export default async function FloorMapPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasModulePermission(user.role, user.permissions, "floor_map")) {
    redirect(firstPermittedPath(user.permissions) ?? "/no-access");
  }

  const [locations, bookings, discountRules, pricingRules, preferredCustomers] =
    await Promise.all([
      getLocations(),
      getBookingsForDay(),
      getDiscountRules(),
      getActivePricingRules(),
      getPreferredCustomers(),
    ]);

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
      />
    </div>
  );
}
