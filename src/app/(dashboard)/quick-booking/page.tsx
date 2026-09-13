import { redirect } from "next/navigation";
import { getLocations } from "@/lib/data/locations";
import { getDiscountRules } from "@/lib/data/discount-rules";
import { getActivePricingRules } from "@/lib/data/pricing-rules";
import { getPreferredCustomers } from "@/lib/actions/preferred-customers";
import { getCurrentUser } from "@/lib/data/current-user";
import { hasModulePermission, firstPermittedPath, canEdit } from "@/lib/permissions";
import QuickBookingClient from "./QuickBookingClient";

export default async function QuickBookingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasModulePermission(user.role, user.permissions, "quick_booking")) {
    redirect(firstPermittedPath(user.permissions) ?? "/no-access");
  }

  const [locations, discountRules, pricingRules, preferredCustomers] = await Promise.all([
    getLocations(),
    getDiscountRules(),
    getActivePricingRules(),
    getPreferredCustomers(),
  ]);

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-brand-forest">Đặt lịch nhanh</h1>
      <p className="mb-3 text-sm text-brand-forest/60">
        Nhập nhanh khách đặt phòng/box/chỗ ngồi — chọn đặt lẻ theo ngày, hoặc đặt định
        kỳ theo tuần/tháng/quý/năm.
      </p>
      <QuickBookingClient
        locations={locations}
        discountRules={discountRules}
        pricingRules={pricingRules}
        preferredCustomers={preferredCustomers}
        isAdmin={user.role === "admin"}
        canEdit={canEdit(user.role, user.view_only)}
      />
    </div>
  );
}
