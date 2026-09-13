"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  CustomerOrgType,
  CustomerType,
  Database,
} from "@/lib/types/database";
import { EQUIPMENT_OPTIONS } from "@/lib/types/database";
import {
  createPreferredCustomer,
  updatePreferredCustomer,
  deletePreferredCustomer,
  type PreferredCustomerInput,
} from "@/lib/actions/preferred-customers";
import ExportExcelButton from "@/components/ExportExcelButton";

type PreferredCustomer = Database["public"]["Tables"]["preferred_customers"]["Row"];

interface PreferredCustomersClientProps {
  preferredCustomers: PreferredCustomer[];
  isAdmin: boolean;
}

export default function PreferredCustomersClient({
  preferredCustomers,
  isAdmin,
}: PreferredCustomersClientProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"list" | "form">("list");
  const [editing, setEditing] = useState<PreferredCustomer | null>(null);

  function openCreate() {
    setEditing(null);
    setMode("form");
  }

  function openEdit(c: PreferredCustomer) {
    setEditing(c);
    setMode("form");
  }

  async function handleDelete(id: string) {
    if (!confirm("Xóa hồ sơ khách VIP/KOL này?")) return;
    const result = await deletePreferredCustomer(id);
    if (result.error) {
      alert(result.error);
      return;
    }
    router.refresh();
  }

  if (mode === "form") {
    return (
      <PreferredCustomerForm
        customer={editing}
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
      <div className="flex items-center justify-between gap-3">
        {isAdmin ? (
          <button
            onClick={openCreate}
            className="w-fit rounded-lg bg-brand-forest px-4 py-2 font-bold text-brand-cream hover:bg-brand-forest/90"
          >
            + Thêm khách VIP/KOL
          </button>
        ) : (
          <span />
        )}
        <ExportExcelButton
          filename="khach-vip-kol"
          sheetName="Khách VIP-KOL"
          rows={preferredCustomers.map((c) => ({
            "Tên khách": c.name,
            SĐT: c.phone ?? "",
            Loại: c.customer_type,
            "Đối tượng":
              c.org_type === "công ty/tổ chức"
                ? c.organization_name || "Công ty/Tổ chức"
                : "Cá nhân",
            "% giảm giá riêng":
              c.custom_discount_percent != null ? `${c.custom_discount_percent}%` : "Mặc định",
            "Trạng thái": c.active ? "Đang áp dụng" : "Tạm ngưng",
          }))}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-brand-forest/15 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-brand-cream text-brand-forest/70">
            <tr>
              <th className="whitespace-nowrap px-3 py-2 font-semibold">Tên khách</th>
              <th className="whitespace-nowrap px-3 py-2 font-semibold">SĐT</th>
              <th className="whitespace-nowrap px-3 py-2 font-semibold">Loại</th>
              <th className="whitespace-nowrap px-3 py-2 font-semibold">Đối tượng</th>
              <th className="whitespace-nowrap px-3 py-2 font-semibold">% giảm giá riêng</th>
              <th className="whitespace-nowrap px-3 py-2 font-semibold">Trạng thái</th>
              {isAdmin && <th className="whitespace-nowrap px-3 py-2 font-semibold"></th>}
            </tr>
          </thead>
          <tbody>
            {preferredCustomers.map((c) => (
              <tr key={c.id} className="border-t border-brand-forest/10">
                <td className="px-3 py-2 font-medium text-brand-forest">{c.name}</td>
                <td className="px-3 py-2 text-brand-forest/80">{c.phone || "-"}</td>
                <td className="px-3 py-2">
                  <span className="rounded-full bg-brand-amber/20 px-2 py-0.5 text-xs font-bold text-brand-amber">
                    {c.customer_type}
                  </span>
                </td>
                <td className="px-3 py-2 text-brand-forest/80">
                  {c.org_type === "công ty/tổ chức"
                    ? c.organization_name || "Công ty/Tổ chức"
                    : "Cá nhân"}
                </td>
                <td className="px-3 py-2 text-brand-forest/80">
                  {c.custom_discount_percent != null
                    ? `${c.custom_discount_percent}%`
                    : "Theo mặc định"}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      c.active
                        ? "bg-brand-forest/10 text-brand-forest"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {c.active ? "Đang áp dụng" : "Tạm ngưng"}
                  </span>
                </td>
                {isAdmin && (
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEdit(c)}
                        className="text-xs font-semibold text-brand-forest hover:underline"
                      >
                        Sửa
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="text-xs font-semibold text-red-600 hover:underline"
                      >
                        Xóa
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {preferredCustomers.length === 0 && (
          <p className="p-4 text-center text-sm text-brand-forest/50">
            Chưa có khách VIP/KOL nào được lưu.
          </p>
        )}
      </div>
    </div>
  );
}

function PreferredCustomerForm({
  customer,
  onDone,
  onCancel,
}: {
  customer: PreferredCustomer | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [customerType, setCustomerType] = useState<CustomerType>(
    customer?.customer_type ?? "VIP"
  );
  const [orgType, setOrgType] = useState<CustomerOrgType>(
    customer?.org_type ?? "cá nhân"
  );
  const [organizationName, setOrganizationName] = useState(
    customer?.organization_name ?? ""
  );
  const [customDiscount, setCustomDiscount] = useState<string>(
    customer?.custom_discount_percent != null
      ? String(customer.custom_discount_percent)
      : ""
  );
  const [equipmentNeeded, setEquipmentNeeded] = useState<string[]>(
    customer?.equipment_needed ?? []
  );
  const [equipmentNote, setEquipmentNote] = useState(customer?.equipment_note ?? "");
  const [note, setNote] = useState(customer?.note ?? "");
  const [active, setActive] = useState(customer?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleEquipment(item: string) {
    setEquipmentNeeded((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const input: PreferredCustomerInput = {
      name,
      phone,
      customer_type: customerType,
      org_type: orgType,
      organization_name: orgType === "công ty/tổ chức" ? organizationName : null,
      custom_discount_percent: customDiscount ? Number(customDiscount) : null,
      equipment_needed: equipmentNeeded,
      equipment_note: equipmentNote,
      note,
      active,
    };

    const result = customer
      ? await updatePreferredCustomer(customer.id, input)
      : await createPreferredCustomer(input);

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
            Tên khách
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
            Số điện thoại
          </label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-forest">
            Loại khách
          </label>
          <select
            value={customerType}
            onChange={(e) => setCustomerType(e.target.value as CustomerType)}
            className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
          >
            <option value="VIP">VIP</option>
            <option value="KOL">KOL</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-forest">
            Khách hàng là
          </label>
          <select
            value={orgType}
            onChange={(e) => setOrgType(e.target.value as CustomerOrgType)}
            className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
          >
            <option value="cá nhân">Cá nhân</option>
            <option value="công ty/tổ chức">Công ty/Tổ chức</option>
          </select>
        </div>
      </div>

      {orgType === "công ty/tổ chức" && (
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-forest">
            Tên công ty/tổ chức
          </label>
          <input
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
            className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
          />
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-brand-forest">
          % giảm giá riêng (để trống = dùng mức mặc định theo hạng {customerType})
        </label>
        <input
          type="number"
          min={0}
          max={100}
          step="0.01"
          value={customDiscount}
          onChange={(e) => setCustomDiscount(e.target.value)}
          placeholder="Mặc định theo hạng"
          className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-brand-forest">
          Thiết bị thường dùng
        </label>
        <div className="flex flex-wrap gap-3">
          {EQUIPMENT_OPTIONS.map((item) => (
            <label
              key={item}
              className="flex items-center gap-1.5 rounded-lg border border-brand-forest/20 px-2 py-1 text-sm text-brand-forest"
            >
              <input
                type="checkbox"
                checked={equipmentNeeded.includes(item)}
                onChange={() => toggleEquipment(item)}
              />
              {item}
            </label>
          ))}
        </div>
        <input
          value={equipmentNote}
          onChange={(e) => setEquipmentNote(e.target.value)}
          placeholder="Thiết bị khác..."
          className="mt-2 w-full rounded-lg border border-brand-forest/30 px-3 py-2 text-sm outline-none focus:border-brand-amber"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-brand-forest">
          Ghi chú
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
        />
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-brand-forest">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />
        Đang áp dụng
      </label>

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
