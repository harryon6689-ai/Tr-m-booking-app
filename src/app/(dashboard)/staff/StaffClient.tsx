"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Database, UserPermissions, UserRole } from "@/lib/types/database";
import {
  createStaffAccount,
  updateStaffAccount,
  resetStaffPassword,
  type StaffAccountInput,
} from "@/lib/actions/staff";
import { PERMISSION_MODULES, DEFAULT_STAFF_PERMISSIONS } from "@/lib/permissions";

type StaffAccount = Database["public"]["Tables"]["users"]["Row"];

function permissionSummary(
  role: UserRole,
  permissions: UserPermissions,
  viewOnly: boolean
): string {
  if (role === "admin") return "Toàn quyền (Admin)";
  const total = PERMISSION_MODULES.length;
  const enabled = PERMISSION_MODULES.filter((m) => permissions[m.key]).length;
  return `${enabled}/${total} module${viewOnly ? " · Chỉ xem" : ""}`;
}

export default function StaffClient({
  accounts,
  currentUserId,
}: {
  accounts: StaffAccount[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"list" | "form">("list");
  const [editing, setEditing] = useState<StaffAccount | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setMode("form");
  }

  function openEdit(account: StaffAccount) {
    setEditing(account);
    setMode("form");
  }

  async function handleResetPassword(id: string) {
    const newPassword = prompt("Nhập mật khẩu mới cho tài khoản này (tối thiểu 6 ký tự):");
    if (!newPassword) return;
    if (newPassword.length < 6) {
      alert("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }
    setResettingId(id);
    const result = await resetStaffPassword(id, newPassword);
    setResettingId(null);
    if (result.error) {
      alert(result.error);
      return;
    }
    alert("Đã đặt lại mật khẩu thành công.");
  }

  if (mode === "form") {
    return (
      <StaffForm
        account={editing}
        isSelf={editing?.id === currentUserId}
        onDone={() => {
          setMode("list");
          router.refresh();
        }}
        onCancel={() => setMode("list")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={openCreate}
        className="w-fit rounded-lg bg-brand-forest px-4 py-2 font-bold text-brand-cream hover:bg-brand-forest/90"
      >
        + Tạo tài khoản nhân viên
      </button>

      <div className="overflow-x-auto rounded-xl border border-brand-forest/15 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-brand-cream text-brand-forest/70">
            <tr>
              <th className="px-3 py-2 font-semibold">Tên</th>
              <th className="px-3 py-2 font-semibold">Số điện thoại</th>
              <th className="px-3 py-2 font-semibold">Vai trò</th>
              <th className="px-3 py-2 font-semibold">Quyền</th>
              <th className="px-3 py-2 font-semibold">Trạng thái</th>
              <th className="px-3 py-2 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id} className="border-t border-brand-forest/10">
                <td className="px-3 py-2 font-medium text-brand-forest">
                  {account.name}
                  {account.id === currentUserId && (
                    <span className="ml-1 text-xs text-brand-forest/50">(bạn)</span>
                  )}
                </td>
                <td className="px-3 py-2 text-brand-forest/80">{account.phone || "-"}</td>
                <td className="px-3 py-2">
                  <span className="rounded-full bg-brand-amber/20 px-2 py-0.5 text-xs font-bold text-brand-amber">
                    {account.role === "admin" ? "Quản lý" : "Nhân viên"}
                  </span>
                </td>
                <td className="px-3 py-2 text-brand-forest/80">
                  {permissionSummary(account.role, account.permissions, account.view_only)}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      account.active
                        ? "bg-brand-forest/10 text-brand-forest"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {account.active ? "Đang hoạt động" : "Đã khóa"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(account)}
                      className="text-xs font-semibold text-brand-forest hover:underline"
                    >
                      Sửa
                    </button>
                    <button
                      onClick={() => handleResetPassword(account.id)}
                      disabled={resettingId === account.id}
                      className="text-xs font-semibold text-brand-forest/70 hover:underline disabled:opacity-50"
                    >
                      Đặt lại mật khẩu
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {accounts.length === 0 && (
          <p className="p-4 text-center text-sm text-brand-forest/50">
            Chưa có tài khoản nào.
          </p>
        )}
      </div>
    </div>
  );
}

function StaffForm({
  account,
  isSelf,
  onDone,
  onCancel,
}: {
  account: StaffAccount | null;
  isSelf: boolean;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(account?.name ?? "");
  const [phone, setPhone] = useState(account?.phone ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>(account?.role ?? "staff");
  const [active, setActive] = useState(account?.active ?? true);
  const [permissions, setPermissions] = useState<UserPermissions>(
    account?.permissions ?? DEFAULT_STAFF_PERMISSIONS
  );
  const [viewOnly, setViewOnly] = useState(account?.view_only ?? false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function togglePermission(key: keyof UserPermissions) {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!account && password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }

    setLoading(true);

    const input: StaffAccountInput = {
      name,
      phone,
      role,
      permissions,
      active,
      view_only: viewOnly,
    };

    const result = account
      ? await updateStaffAccount(account.id, input)
      : await createStaffAccount({ ...input, password });

    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    onDone();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex max-w-xl flex-col gap-3 rounded-xl border border-brand-forest/15 bg-white p-6"
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-forest">
            Tên nhân viên
          </label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-forest">
            Số điện thoại (dùng để đăng nhập)
          </label>
          <input
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="09xxxxxxxx"
            className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
          />
        </div>
      </div>

      {!account && (
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-forest">
            Mật khẩu ban đầu
          </label>
          <input
            type="text"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Tối thiểu 6 ký tự"
            className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-forest">
            Vai trò
          </label>
          <select
            value={role}
            disabled={isSelf}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber disabled:opacity-50"
          >
            <option value="staff">Nhân viên</option>
            <option value="admin">Quản lý (Admin — toàn quyền)</option>
          </select>
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-sm font-medium text-brand-forest">
            <input
              type="checkbox"
              checked={active}
              disabled={isSelf}
              onChange={(e) => setActive(e.target.checked)}
            />
            Đang hoạt động
          </label>
        </div>
      </div>

      {isSelf && (
        <p className="text-xs text-brand-forest/60">
          Bạn không thể tự đổi vai trò hoặc tự khóa tài khoản đang đăng nhập.
        </p>
      )}

      {role === "staff" && (
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-forest">
            Quyền truy cập từng module
          </label>
          <div className="flex flex-col gap-1.5 rounded-lg border border-brand-forest/15 p-3">
            {PERMISSION_MODULES.map((m) => (
              <label
                key={m.key}
                className="flex items-center gap-2 text-sm text-brand-forest"
              >
                <input
                  type="checkbox"
                  checked={permissions[m.key]}
                  onChange={() => togglePermission(m.key)}
                />
                {m.label}
              </label>
            ))}
          </div>
        </div>
      )}

      {role === "staff" && (
        <div className="rounded-lg border border-brand-forest/15 p-3">
          <label className="flex items-center gap-2 text-sm font-medium text-brand-forest">
            <input
              type="checkbox"
              checked={viewOnly}
              onChange={(e) => setViewOnly(e.target.checked)}
            />
            Chỉ xem (không được tạo/sửa/hủy đặt chỗ ở các module được phép xem)
          </label>
        </div>
      )}

      {role === "admin" && (
        <p className="text-xs text-brand-forest/60">
          Tài khoản Admin luôn có toàn quyền trên mọi module, không cần chọn riêng.
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="mt-2 flex justify-between">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-brand-forest/30 px-4 py-2 font-medium text-brand-forest hover:bg-brand-cream"
        >
          Quay lại
        </button>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-brand-amber px-4 py-2 font-medium text-white hover:bg-brand-amber/90 disabled:opacity-60"
        >
          {loading ? "Đang lưu..." : "Lưu"}
        </button>
      </div>
    </form>
  );
}
