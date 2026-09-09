import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/data/current-user";
import { getAllStaffAccounts } from "@/lib/actions/staff";
import StaffClient from "./StaffClient";

export default async function StaffPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    redirect("/");
  }

  const accounts = await getAllStaffAccounts();

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-brand-forest">Quản lý nhân viên</h1>
      <p className="mb-3 text-sm text-brand-forest/60">
        Tạo tài khoản đăng nhập bằng số điện thoại và bật/tắt quyền truy cập từng
        module cho từng nhân viên.
      </p>
      <StaffClient accounts={accounts} currentUserId={user.id} />
    </div>
  );
}
