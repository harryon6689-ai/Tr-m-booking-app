import type { UserPermissions, UserRole } from "@/lib/types/database";

export const PERMISSION_MODULES = [
  { key: "floor_map", path: "/", label: "Bản đồ mặt bằng" },
  { key: "checkin", path: "/check-in", label: "Khách đã booking" },
  { key: "quick_booking", path: "/quick-booking", label: "Đặt lịch nhanh" },
  { key: "kol", path: "/kol", label: "Lịch KOL Review" },
  { key: "history", path: "/history", label: "Lịch sử" },
  { key: "fixed_customers", path: "/fixed-customers", label: "Khách cố định" },
  { key: "preferred_customers", path: "/preferred-customers", label: "Khách VIP/KOL" },
  { key: "discount_rules", path: "/discount-rules", label: "Chính sách giá" },
] as const satisfies readonly { key: keyof UserPermissions; path: string; label: string }[];

export const DEFAULT_STAFF_PERMISSIONS: UserPermissions = {
  floor_map: true,
  checkin: true,
  quick_booking: true,
  kol: true,
  history: true,
  fixed_customers: true,
  preferred_customers: true,
  discount_rules: true,
  discount_rules_edit: false,
};

export function hasModulePermission(
  role: UserRole,
  permissions: UserPermissions | null | undefined,
  key: keyof UserPermissions
): boolean {
  if (role === "admin") return true;
  return permissions?.[key] ?? false;
}

/** First module path a staff account is allowed to see, or null if none. */
export function firstPermittedPath(permissions: UserPermissions | null | undefined): string | null {
  const found = PERMISSION_MODULES.find((m) => permissions?.[m.key]);
  return found ? found.path : null;
}

/** Admins always keep full edit access; a "view only" staff account can see but not mutate. */
export function canEdit(role: UserRole, viewOnly: boolean): boolean {
  return role === "admin" || !viewOnly;
}

/**
 * Chính sách giá (discount/pricing rules) is view-only for staff by default —
 * a separate opt-in flag (independent of the account-wide "view only" toggle)
 * lets an admin grant a specific staff member edit access to this page.
 */
export function canEditPricing(
  role: UserRole,
  permissions: UserPermissions | null | undefined
): boolean {
  return role === "admin" || permissions?.discount_rules_edit === true;
}
