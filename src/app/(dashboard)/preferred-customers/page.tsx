import { redirect } from "next/navigation";
import { getAllPreferredCustomers } from "@/lib/actions/preferred-customers";
import { getCurrentUser } from "@/lib/data/current-user";
import { hasModulePermission, firstPermittedPath } from "@/lib/permissions";
import PreferredCustomersClient from "./PreferredCustomersClient";

export default async function PreferredCustomersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasModulePermission(user.role, user.permissions, "preferred_customers")) {
    redirect(firstPermittedPath(user.permissions) ?? "/no-access");
  }

  const preferredCustomers = await getAllPreferredCustomers();

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-brand-forest">Khách VIP/KOL</h1>
      <p className="mb-3 text-sm text-brand-forest/60">
        Hồ sơ khách kèm chính sách giảm giá riêng — khi tạo booking, nhập đúng tên
        hoặc SĐT đã lưu sẽ tự gợi ý và điền sẵn thông tin của khách.
      </p>
      <PreferredCustomersClient
        preferredCustomers={preferredCustomers}
        isAdmin={user.role === "admin"}
      />
    </div>
  );
}
