import { redirect } from "next/navigation";
import { getAllDiscountRules } from "@/lib/data/discount-rules";
import { getAllPricingRules } from "@/lib/data/pricing-rules";
import { getLocations } from "@/lib/data/locations";
import { getCurrentUser } from "@/lib/data/current-user";
import { hasModulePermission, firstPermittedPath } from "@/lib/permissions";
import DiscountRulesClient from "./DiscountRulesClient";

export default async function DiscountRulesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasModulePermission(user.role, user.permissions, "discount_rules")) {
    redirect(firstPermittedPath(user.permissions) ?? "/no-access");
  }

  const [discountRules, pricingRules, locations] = await Promise.all([
    getAllDiscountRules(),
    getAllPricingRules(),
    getLocations(),
  ]);

  return (
    <div>
      <h1 className="mb-3 text-2xl font-bold text-brand-forest">Chính sách giá</h1>
      <DiscountRulesClient
        discountRules={discountRules}
        pricingRules={pricingRules}
        locations={locations}
        isAdmin={user.role === "admin"}
      />
    </div>
  );
}
