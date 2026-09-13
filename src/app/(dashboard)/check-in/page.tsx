import { redirect } from "next/navigation";
import { getCheckinList } from "@/lib/actions/booking-history";
import { getLocations } from "@/lib/data/locations";
import { getDiscountRules } from "@/lib/data/discount-rules";
import { getActivePricingRules } from "@/lib/data/pricing-rules";
import { getPreferredCustomers } from "@/lib/actions/preferred-customers";
import { getCurrentUser } from "@/lib/data/current-user";
import { hasModulePermission, firstPermittedPath, canEdit } from "@/lib/permissions";
import CheckInClient from "./CheckInClient";

export default async function CheckInPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasModulePermission(user.role, user.permissions, "checkin")) {
    redirect(firstPermittedPath(user.permissions) ?? "/no-access");
  }

  const today = new Date().toISOString().slice(0, 10);
  const [initialRows, locations, discountRules, pricingRules, preferredCustomers] =
    await Promise.all([
      getCheckinList({ dateFrom: today, dateTo: today }),
      getLocations(),
      getDiscountRules(),
      getActivePricingRules(),
      getPreferredCustomers(),
    ]);

  return (
    <div>
      <h1 className="mb-3 text-2xl font-bold text-brand-forest">Khách đã booking</h1>
      <CheckInClient
        initialRows={initialRows}
        initialDate={today}
        locations={locations}
        discountRules={discountRules}
        pricingRules={pricingRules}
        preferredCustomers={preferredCustomers}
        canEdit={canEdit(user.role, user.view_only)}
      />
    </div>
  );
}
