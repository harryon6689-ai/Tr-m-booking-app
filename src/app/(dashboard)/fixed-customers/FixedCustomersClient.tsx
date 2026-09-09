"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Database, RecurrenceType } from "@/lib/types/database";
import {
  createFixedCustomer,
  updateFixedCustomer,
  deleteFixedCustomer,
  type FixedCustomerInput,
} from "@/lib/actions/fixed-customers";

type Location = Database["public"]["Tables"]["locations"]["Row"];
type FixedCustomer = Database["public"]["Tables"]["fixed_customers"]["Row"];

const WEEKDAY_LABELS = [
  "Chủ nhật",
  "Thứ 2",
  "Thứ 3",
  "Thứ 4",
  "Thứ 5",
  "Thứ 6",
  "Thứ 7",
];

function describeRecurrence(rule: FixedCustomer): string {
  switch (rule.recurrence_type) {
    case "hàng tuần":
      return `Hàng tuần - ${WEEKDAY_LABELS[rule.weekday ?? 0]}`;
    case "hàng tháng":
      return `Hàng tháng - ngày ${rule.day_of_month}`;
    case "ngày cụ thể":
      return `${(rule.custom_dates ?? []).length} ngày cụ thể`;
    default:
      return "";
  }
}

interface FixedCustomersClientProps {
  locations: Location[];
  fixedCustomers: FixedCustomer[];
  isAdmin: boolean;
}

export default function FixedCustomersClient({
  locations,
  fixedCustomers,
  isAdmin,
}: FixedCustomersClientProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"list" | "form">("list");
  const [editing, setEditing] = useState<FixedCustomer | null>(null);

  const locationName = (id: string) =>
    locations.find((l) => l.id === id)?.name ?? "?";

  function openCreate() {
    setEditing(null);
    setMode("form");
  }

  function openEdit(rule: FixedCustomer) {
    setEditing(rule);
    setMode("form");
  }

  async function handleDelete(id: string) {
    if (!confirm("Xóa lịch khách cố định này?")) return;
    const result = await deleteFixedCustomer(id);
    if (result.error) {
      alert(result.error);
      return;
    }
    router.refresh();
  }

  if (mode === "form") {
    return (
      <FixedCustomerForm
        locations={locations}
        rule={editing}
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
      {isAdmin && (
        <button
          onClick={openCreate}
          className="w-fit rounded-lg bg-brand-forest px-4 py-2 font-bold text-brand-cream hover:bg-brand-forest/90"
        >
          + Thêm khách cố định
        </button>
      )}

      <div className="overflow-x-auto rounded-xl border border-brand-forest/15 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-brand-cream text-brand-forest/70">
            <tr>
              <th className="px-3 py-2 font-semibold">Vị trí</th>
              <th className="px-3 py-2 font-semibold">Khách hàng</th>
              <th className="px-3 py-2 font-semibold">Lặp lại</th>
              <th className="px-3 py-2 font-semibold">Giờ</th>
              <th className="px-3 py-2 font-semibold">Hiệu lực</th>
              <th className="px-3 py-2 font-semibold">Trạng thái</th>
              {isAdmin && <th className="px-3 py-2 font-semibold"></th>}
            </tr>
          </thead>
          <tbody>
            {fixedCustomers.map((rule) => (
              <tr key={rule.id} className="border-t border-brand-forest/10">
                <td className="px-3 py-2 text-brand-forest/80">
                  {locationName(rule.location_id)}
                </td>
                <td className="px-3 py-2 font-medium text-brand-forest">
                  {rule.customer_name}
                  {rule.phone && (
                    <span className="block text-xs text-brand-forest/60">
                      {rule.phone}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-brand-forest/80">
                  {describeRecurrence(rule)}
                </td>
                <td className="px-3 py-2 text-brand-forest/80">
                  {rule.start_time.slice(0, 5)} - {rule.end_time.slice(0, 5)}
                </td>
                <td className="px-3 py-2 text-brand-forest/80">
                  {rule.effective_from}
                  {rule.effective_until ? ` → ${rule.effective_until}` : " → vô thời hạn"}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      rule.active
                        ? "bg-brand-forest/10 text-brand-forest"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {rule.active ? "Đang áp dụng" : "Tạm ngưng"}
                  </span>
                </td>
                {isAdmin && (
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEdit(rule)}
                        className="text-xs font-semibold text-brand-forest hover:underline"
                      >
                        Sửa
                      </button>
                      <button
                        onClick={() => handleDelete(rule.id)}
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
        {fixedCustomers.length === 0 && (
          <p className="p-4 text-center text-sm text-brand-forest/50">
            Chưa có khách cố định nào.
          </p>
        )}
      </div>
    </div>
  );
}

function FixedCustomerForm({
  locations,
  rule,
  onDone,
  onCancel,
}: {
  locations: Location[];
  rule: FixedCustomer | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [locationId, setLocationId] = useState(rule?.location_id ?? locations[0]?.id ?? "");
  const [customerName, setCustomerName] = useState(rule?.customer_name ?? "");
  const [phone, setPhone] = useState(rule?.phone ?? "");
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(
    rule?.recurrence_type ?? "hàng tuần"
  );
  const [weekday, setWeekday] = useState(rule?.weekday ?? 1);
  const [dayOfMonth, setDayOfMonth] = useState(rule?.day_of_month ?? 1);
  const [customDates, setCustomDates] = useState<string[]>(rule?.custom_dates ?? []);
  const [newDate, setNewDate] = useState("");
  const [startTime, setStartTime] = useState(rule?.start_time.slice(0, 5) ?? "09:00");
  const [endTime, setEndTime] = useState(rule?.end_time.slice(0, 5) ?? "11:00");
  const [effectiveFrom, setEffectiveFrom] = useState(
    rule?.effective_from ?? new Date().toISOString().slice(0, 10)
  );
  const [effectiveUntil, setEffectiveUntil] = useState(rule?.effective_until ?? "");
  const [active, setActive] = useState(rule?.active ?? true);
  const [note, setNote] = useState(rule?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function addCustomDate() {
    if (newDate && !customDates.includes(newDate)) {
      setCustomDates([...customDates, newDate].sort());
      setNewDate("");
    }
  }

  function removeCustomDate(d: string) {
    setCustomDates(customDates.filter((x) => x !== d));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (endTime <= startTime) {
      setError("Giờ kết thúc phải sau giờ bắt đầu.");
      return;
    }
    if (recurrenceType === "ngày cụ thể" && customDates.length === 0) {
      setError("Thêm ít nhất 1 ngày cụ thể.");
      return;
    }

    setLoading(true);

    const input: FixedCustomerInput = {
      location_id: locationId,
      customer_name: customerName,
      phone,
      recurrence_type: recurrenceType,
      weekday: recurrenceType === "hàng tuần" ? weekday : null,
      day_of_month: recurrenceType === "hàng tháng" ? dayOfMonth : null,
      custom_dates: recurrenceType === "ngày cụ thể" ? customDates : null,
      start_time: startTime,
      end_time: endTime,
      effective_from: effectiveFrom,
      effective_until: effectiveUntil || null,
      active,
      note,
    };

    const result = rule
      ? await updateFixedCustomer(rule.id, input)
      : await createFixedCustomer(input);

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
      <div>
        <label className="mb-1 block text-sm font-medium text-brand-forest">
          Vị trí
        </label>
        <select
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
        >
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-forest">
            Tên khách
          </label>
          <input
            required
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
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

      <div>
        <label className="mb-1 block text-sm font-medium text-brand-forest">
          Kiểu lặp lại
        </label>
        <select
          value={recurrenceType}
          onChange={(e) => setRecurrenceType(e.target.value as RecurrenceType)}
          className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
        >
          <option value="hàng tuần">Hàng tuần</option>
          <option value="hàng tháng">Hàng tháng</option>
          <option value="ngày cụ thể">Ngày cụ thể</option>
        </select>
      </div>

      {recurrenceType === "hàng tuần" && (
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-forest">
            Vào thứ
          </label>
          <select
            value={weekday}
            onChange={(e) => setWeekday(Number(e.target.value))}
            className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
          >
            {WEEKDAY_LABELS.map((label, i) => (
              <option key={i} value={i}>
                {label}
              </option>
            ))}
          </select>
        </div>
      )}

      {recurrenceType === "hàng tháng" && (
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-forest">
            Vào ngày (1-31)
          </label>
          <input
            type="number"
            min={1}
            max={31}
            value={dayOfMonth}
            onChange={(e) => setDayOfMonth(Number(e.target.value))}
            className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
          />
        </div>
      )}

      {recurrenceType === "ngày cụ thể" && (
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-forest">
            Danh sách ngày
          </label>
          <div className="mb-2 flex gap-2">
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
            />
            <button
              type="button"
              onClick={addCustomDate}
              className="rounded-lg border border-brand-forest/30 px-3 py-2 text-sm font-medium text-brand-forest hover:bg-brand-cream"
            >
              + Thêm
            </button>
          </div>
          <ul className="flex flex-wrap gap-2">
            {customDates.map((d) => (
              <li
                key={d}
                className="flex items-center gap-1 rounded-full bg-brand-cream px-2 py-1 text-xs text-brand-forest"
              >
                {d}
                <button
                  type="button"
                  onClick={() => removeCustomDate(d)}
                  className="text-brand-forest/60 hover:text-red-600"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
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

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-forest">
            Hiệu lực từ
          </label>
          <input
            type="date"
            required
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
            className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-forest">
            Hiệu lực đến (để trống = vô thời hạn)
          </label>
          <input
            type="date"
            value={effectiveUntil}
            onChange={(e) => setEffectiveUntil(e.target.value)}
            className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-brand-forest">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />
        Đang áp dụng
      </label>

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
