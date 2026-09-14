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
import { createBooking, type BookingInput } from "@/lib/actions/bookings";
import ExportExcelButton from "@/components/ExportExcelButton";
import ReviewRow from "@/components/ReviewRow";
import CurrencyInput from "@/components/CurrencyInput";

type PreferredCustomer = Database["public"]["Tables"]["preferred_customers"]["Row"];
type Location = Database["public"]["Tables"]["locations"]["Row"];
type DiscountRule = Database["public"]["Tables"]["discount_rules"]["Row"];

type LocationGroup = "phòng" | "box" | "ghế ngoài";

const LOCATION_GROUP_OPTIONS: { value: LocationGroup; label: string }[] = [
  { value: "phòng", label: "Phòng" },
  { value: "box", label: "Box" },
  { value: "ghế ngoài", label: "Khu ngồi ngoài" },
];

function locationMatchesGroup(loc: Location, group: LocationGroup): boolean {
  if (group === "phòng") return loc.type === "phòng lớn" || loc.type === "phòng nhỏ";
  return loc.type === group;
}

interface PreferredCustomersClientProps {
  preferredCustomers: PreferredCustomer[];
  locations: Location[];
  discountRules: DiscountRule[];
  isAdmin: boolean;
  canEdit: boolean;
}

export default function PreferredCustomersClient({
  preferredCustomers,
  locations,
  discountRules,
  isAdmin,
  canEdit,
}: PreferredCustomersClientProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"list" | "form" | "booking">("list");
  const [editing, setEditing] = useState<PreferredCustomer | null>(null);
  const [booking, setBooking] = useState<PreferredCustomer | null>(null);

  function openCreate() {
    setEditing(null);
    setMode("form");
  }

  function openEdit(c: PreferredCustomer) {
    setEditing(c);
    setMode("form");
  }

  function openBooking(c: PreferredCustomer) {
    setBooking(c);
    setMode("booking");
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

  if (mode === "booking" && booking) {
    return (
      <PreferredCustomerBookingForm
        customer={booking}
        locations={locations}
        discountRules={discountRules}
        canEdit={canEdit}
        onDone={() => setMode("list")}
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
              <th className="whitespace-nowrap px-3 py-2 font-semibold"></th>
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
                <td className="px-3 py-2">
                  {canEdit && (
                    <button
                      onClick={() => openBooking(c)}
                      className="inline-flex min-h-10 items-center px-2 text-xs font-semibold text-brand-forest hover:underline"
                    >
                      Đặt lịch
                    </button>
                  )}
                </td>
                {isAdmin && (
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(c)}
                        className="inline-flex min-h-10 items-center px-2 text-xs font-semibold text-brand-forest hover:underline"
                      >
                        Sửa
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="inline-flex min-h-10 items-center px-2 text-xs font-semibold text-red-600 hover:underline"
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function PreferredCustomerBookingForm({
  customer,
  locations,
  discountRules,
  canEdit,
  onDone,
  onCancel,
}: {
  customer: PreferredCustomer;
  locations: Location[];
  discountRules: DiscountRule[];
  canEdit: boolean;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [locationGroup, setLocationGroup] = useState<LocationGroup>(
    (() => {
      const firstMatch = LOCATION_GROUP_OPTIONS.find((g) =>
        locations.some((l) => locationMatchesGroup(l, g.value))
      );
      return firstMatch?.value ?? "phòng";
    })()
  );
  const groupLocations = locations.filter((l) => locationMatchesGroup(l, locationGroup));
  const [locationId, setLocationId] = useState(groupLocations[0]?.id ?? "");
  const [seatNumber, setSeatNumber] = useState("");
  const [date, setDate] = useState(todayStr());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("11:00");
  const [attendeeCount, setAttendeeCount] = useState("");
  const [depositAmount, setDepositAmount] = useState(0);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const location = locations.find((l) => l.id === locationId) ?? null;

  function handleGroupChange(group: LocationGroup) {
    setLocationGroup(group);
    const first = locations.find((l) => locationMatchesGroup(l, group));
    setLocationId(first?.id ?? "");
    setSeatNumber("");
  }

  const discountPercent =
    customer.custom_discount_percent != null
      ? Number(customer.custom_discount_percent)
      : Number(
          discountRules.find(
            (r) => r.customer_type === customer.customer_type && r.discount_type === "phòng"
          )?.default_percent ?? 0
        );

  const durationHours =
    startTime && endTime
      ? Math.max(
          0,
          (new Date(`${date}T${endTime}:00`).getTime() -
            new Date(`${date}T${startTime}:00`).getTime()) /
            3_600_000
        )
      : 0;
  const overageHours = location ? Math.max(0, durationHours - location.included_hours) : 0;
  const overageFee =
    location && overageHours > 0 ? overageHours * (location.overage_fee_per_hour ?? 0) : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!location) {
      setError("Chọn vị trí.");
      return;
    }
    if (endTime <= startTime) {
      setError("Giờ kết thúc phải sau giờ bắt đầu.");
      return;
    }

    setLoading(true);

    const input: BookingInput = {
      location_id: location.id,
      customer_name: customer.name,
      phone: customer.phone ?? "",
      start_time: new Date(`${date}T${startTime}:00`).toISOString(),
      end_time: new Date(`${date}T${endTime}:00`).toISOString(),
      status: "đã đặt",
      deposit_amount: depositAmount,
      discount_applied: discountPercent,
      final_price: 0,
      overage_fee: overageFee,
      overage_fee_paid: false,
      minimum_spend_shortfall_paid: false,
      note,
      org_type: customer.org_type,
      organization_name: customer.org_type === "công ty/tổ chức" ? customer.organization_name : null,
      attendee_count: attendeeCount ? Number(attendeeCount) : null,
      equipment_needed: customer.equipment_needed ?? [],
      equipment_note: customer.equipment_note ?? "",
      pricing_rule_id: null,
      vat_invoice_requested: false,
      vat_company_name: null,
      vat_company_address: null,
      vat_tax_code: null,
      vat_email: null,
      actual_drink_spend: 0,
      seat_number: location.type === "ghế ngoài" ? seatNumber || null : null,
    };

    const result = await createBooking(input);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccess(
      `Đã đặt chỗ cho "${customer.name}" tại ${location.name}, ngày ${date} (${startTime} - ${endTime}).`
    );
  }

  if (success) {
    return (
      <div className="flex max-w-xl flex-col items-center gap-4 rounded-xl border border-brand-forest/15 bg-white p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-forest/10 text-3xl text-brand-forest">
          ✓
        </div>
        <div>
          <p className="text-lg font-bold text-brand-forest">Đặt lịch thành công!</p>
          <p className="mt-1 text-sm text-brand-forest/70">{success}</p>
        </div>
        <button
          onClick={onDone}
          className="rounded-lg bg-brand-amber px-5 py-2 font-bold text-white hover:bg-brand-amber/90"
        >
          Đóng
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex max-w-xl flex-col gap-3 rounded-xl border border-brand-forest/15 bg-white p-6"
    >
      <div className="rounded-lg border border-brand-forest/15 px-4">
        <ReviewRow label="Khách" value={`${customer.name} (${customer.customer_type})`} />
        <ReviewRow label="Số điện thoại" value={customer.phone || "-"} />
        <ReviewRow label="Giảm giá áp dụng" value={`${discountPercent}%`} />
      </div>

      {!canEdit && (
        <p className="rounded-lg bg-brand-forest/10 px-3 py-2 text-xs font-medium text-brand-forest/70">
          Tài khoản chỉ xem, không thể đặt chỗ.
        </p>
      )}
      <fieldset disabled={!canEdit} className="contents">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-brand-forest">
          Loại vị trí
        </label>
        <div className="flex flex-wrap gap-1.5">
          {LOCATION_GROUP_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => handleGroupChange(o.value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-bold transition ${
                locationGroup === o.value
                  ? "bg-brand-forest text-brand-cream"
                  : "border border-brand-forest/30 text-brand-forest hover:bg-brand-cream"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-brand-forest">
          Vị trí cụ thể
        </label>
        <select
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
        >
          {groupLocations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        {groupLocations.length === 0 && (
          <p className="mt-1 text-xs text-red-600">Không có vị trí nào thuộc loại này.</p>
        )}
      </div>

      {location?.type === "ghế ngoài" && (
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-forest">
            Số vị trí
          </label>
          <input
            value={seatNumber}
            onChange={(e) => setSeatNumber(e.target.value)}
            placeholder="VD: A12"
            className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-forest">Ngày</label>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-forest">
            Giờ bắt đầu
          </label>
          <input
            type="time"
            required
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-forest">
            Giờ kết thúc
          </label>
          <input
            type="time"
            required
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
          />
        </div>
      </div>

      {overageHours > 0 && location && (
        <p className="rounded-lg bg-brand-cream px-3 py-2 text-xs font-medium text-brand-forest">
          Thời lượng đặt chỗ vượt <span className="font-bold">{location.included_hours}h</span>{" "}
          quy định {overageHours.toFixed(1)}h — phụ thu thêm giờ tự tính:{" "}
          <span className="font-bold">{overageFee.toLocaleString("vi-VN")}đ</span>.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-forest">
            Số người tham gia
          </label>
          <input
            type="number"
            min={0}
            value={attendeeCount}
            onChange={(e) => setAttendeeCount(e.target.value)}
            className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-forest">
            Tiền cọc
          </label>
          <CurrencyInput
            value={depositAmount}
            onChange={setDepositAmount}
            className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-brand-forest">Ghi chú</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
        />
      </div>
      </fieldset>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="mt-2 flex justify-between">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-brand-forest/30 px-4 py-2 font-medium text-brand-forest hover:bg-brand-cream"
        >
          Quay lại
        </button>
        {canEdit && (
          <button
            type="submit"
            disabled={loading || !location}
            className="rounded-lg bg-brand-amber px-4 py-2 font-medium text-white hover:bg-brand-amber/90 disabled:opacity-60"
          >
            {loading ? "Đang lưu..." : "Đặt chỗ"}
          </button>
        )}
      </div>
    </form>
  );
}
