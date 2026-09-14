"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Database, RecurrenceType } from "@/lib/types/database";
import {
  createFixedCustomer,
  updateFixedCustomer,
  deleteFixedCustomer,
  getFixedCustomerSchedule,
  type FixedCustomerInput,
  type FixedCustomerOccurrence,
} from "@/lib/actions/fixed-customers";
import ExportExcelButton from "@/components/ExportExcelButton";
import CurrencyInput from "@/components/CurrencyInput";
import ReviewRow from "@/components/ReviewRow";
import WeekdayPicker, { WEEKDAY_LABELS } from "@/components/WeekdayPicker";
import DayOfMonthPicker from "@/components/DayOfMonthPicker";
import DateListPicker from "@/components/DateListPicker";
import {
  defaultEffectiveUntil,
  formatDateDMY,
  formatDayMonth,
  needsRenewalReminder,
  ymd,
} from "@/lib/fixed-customers-utils";

type Location = Database["public"]["Tables"]["locations"]["Row"];
type FixedCustomer = Database["public"]["Tables"]["fixed_customers"]["Row"];

type RecurrenceFilter = "all" | RecurrenceType;

const RECURRENCE_FILTER_OPTIONS: { value: RecurrenceFilter; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "hàng tuần", label: "Hàng tuần" },
  { value: "hàng tháng", label: "Hàng tháng" },
  { value: "hàng quý", label: "Hàng quý" },
  { value: "hàng năm", label: "Hàng năm" },
  { value: "ngày cụ thể", label: "Ngày cụ thể" },
];

function formatMoney(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}

function describeRecurrence(rule: FixedCustomer): string {
  switch (rule.recurrence_type) {
    case "hàng tuần":
      return `Hàng tuần - ${(rule.weekday ?? []).map((w) => WEEKDAY_LABELS[w]).join(", ")}`;
    case "hàng tháng":
      return `Hàng tháng - ngày ${(rule.day_of_month ?? []).join(", ")}`;
    case "hàng quý":
      return `Hàng quý - ngày ${(rule.day_of_month ?? []).join(", ")}`;
    case "hàng năm":
      return `Hàng năm - ${(rule.custom_dates ?? []).map(formatDayMonth).join(", ")}`;
    case "ngày cụ thể":
      return `${(rule.custom_dates ?? []).length} ngày cụ thể`;
    default:
      return "";
  }
}

/**
 * True if the rule's active period [effective_from, effective_until] overlaps
 * [from, to]. An empty `from`/`to` means that side of the range is unbounded.
 */
function overlapsDateRange(rule: FixedCustomer, from: string, to: string) {
  if (to && rule.effective_from > to) return false;
  if (from && rule.effective_until && rule.effective_until < from) return false;
  return true;
}

interface FixedCustomersClientProps {
  locations: Location[];
  fixedCustomers: FixedCustomer[];
  isAdmin: boolean;
  canEdit: boolean;
}

export default function FixedCustomersClient({
  locations,
  fixedCustomers,
  isAdmin,
  canEdit,
}: FixedCustomersClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"list" | "form">("list");
  const [editing, setEditing] = useState<FixedCustomer | null>(null);
  const [viewing, setViewing] = useState<FixedCustomer | null>(null);
  const [recurrenceFilter, setRecurrenceFilter] = useState<RecurrenceFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [nameQuery, setNameQuery] = useState("");
  const today = ymd(new Date());

  const locationName = (id: string) =>
    locations.find((l) => l.id === id)?.name ?? "?";

  const filteredCustomers = fixedCustomers
    .filter((rule) => {
      if (recurrenceFilter !== "all" && rule.recurrence_type !== recurrenceFilter) {
        return false;
      }
      if ((dateFrom || dateTo) && !overlapsDateRange(rule, dateFrom, dateTo)) {
        return false;
      }
      const q = nameQuery.trim().toLowerCase();
      if (q && !rule.customer_name.toLowerCase().includes(q) && !(rule.phone ?? "").includes(q)) {
        return false;
      }
      return true;
    })
    // Rules needing renewal float to the top so staff notice them first;
    // everything else stays alphabetical for easy scanning.
    .sort((a, b) => {
      const aNeeds = needsRenewalReminder(a, today);
      const bNeeds = needsRenewalReminder(b, today);
      if (aNeeds !== bNeeds) return aNeeds ? -1 : 1;
      return a.customer_name.localeCompare(b.customer_name, "vi");
    });

  function openCreate() {
    setEditing(null);
    setMode("form");
  }

  function openEdit(rule: FixedCustomer) {
    setEditing(rule);
    setMode("form");
  }

  useEffect(() => {
    const editId = searchParams.get("edit");
    const renewId = searchParams.get("renew");
    if (editId) {
      const rule = fixedCustomers.find((f) => f.id === editId);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- deep-link from check-in page opens the edit form
      if (rule) openEdit(rule);
    } else if (renewId) {
      const rule = fixedCustomers.find((f) => f.id === renewId);
      if (rule) openRenew(rule);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only run for the deep-link param on mount
  }, [searchParams]);

  async function handleDelete(id: string) {
    if (!confirm("Xóa lịch khách cố định này?")) return;
    const result = await deleteFixedCustomer(id);
    if (result.error) {
      alert(result.error);
      return;
    }
    router.refresh();
  }

  function openRenew(rule: FixedCustomer) {
    // A renewal continues right after the old expiry — start fresh from the
    // next day, with no end date yet, so staff just pick the new "kỳ" and the
    // matching default "Hiệu lực đến" auto-fills (rest of the info is already
    // pre-filled from the existing customer).
    const nextDay = new Date(`${rule.effective_until}T00:00:00`);
    nextDay.setDate(nextDay.getDate() + 1);
    setEditing({ ...rule, effective_from: ymd(nextDay), effective_until: null });
    setMode("form");
  }

  function closeForm() {
    setMode("list");
    if (searchParams.get("edit") || searchParams.get("renew")) {
      router.replace("/fixed-customers");
    }
  }

  if (mode === "form") {
    return (
      <FixedCustomerForm
        locations={locations}
        rule={editing}
        onDone={() => {
          closeForm();
          router.refresh();
        }}
        onCancel={closeForm}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        {canEdit ? (
          <button
            onClick={openCreate}
            className="w-fit rounded-lg bg-brand-forest px-4 py-2 font-bold text-brand-cream hover:bg-brand-forest/90"
          >
            + Thêm khách cố định
          </button>
        ) : (
          <span />
        )}
        <ExportExcelButton
          filename="khach-co-dinh"
          sheetName="Khách cố định"
          rows={filteredCustomers.map((rule) => ({
            "Khách hàng": rule.customer_name,
            SĐT: rule.phone ?? "",
            "Vị trí": locationName(rule.location_id),
            "Số vị trí": rule.seat_number ?? "",
            "Lặp lại": describeRecurrence(rule),
            Giờ: `${rule.start_time.slice(0, 5)} - ${rule.end_time.slice(0, 5)}`,
            "Hiệu lực từ": rule.effective_from,
            "Hiệu lực đến": rule.effective_until ?? "Vô thời hạn",
            "Tiền cọc": rule.deposit_amount,
            "Trạng thái": rule.active ? "Đang áp dụng" : "Tạm ngưng",
          }))}
        />
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-brand-forest/15 bg-white p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-brand-forest/70">Tìm khách/SĐT</label>
          <input
            value={nameQuery}
            onChange={(e) => setNameQuery(e.target.value)}
            placeholder="Tên hoặc SĐT"
            className="rounded-lg border border-brand-forest/30 px-3 py-1.5 text-sm outline-none focus:border-brand-amber"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-brand-forest/70">Kiểu lặp lại</label>
          <select
            value={recurrenceFilter}
            onChange={(e) => setRecurrenceFilter(e.target.value as RecurrenceFilter)}
            className="rounded-lg border border-brand-forest/30 px-3 py-1.5 text-sm font-bold text-brand-forest outline-none focus:border-brand-amber"
          >
            {RECURRENCE_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-brand-forest/70">Từ ngày</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-brand-forest/30 px-3 py-1.5 text-sm outline-none focus:border-brand-amber"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-brand-forest/70">Đến ngày</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-brand-forest/30 px-3 py-1.5 text-sm outline-none focus:border-brand-amber"
          />
        </div>
        {(recurrenceFilter !== "all" || dateFrom || dateTo || nameQuery) && (
          <button
            type="button"
            onClick={() => {
              setRecurrenceFilter("all");
              setDateFrom("");
              setDateTo("");
              setNameQuery("");
            }}
            className="rounded-lg border border-brand-forest/30 px-3 py-1.5 text-sm font-semibold text-brand-forest hover:bg-brand-cream"
          >
            Bỏ lọc
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-brand-forest/15 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-brand-cream text-brand-forest/70">
            <tr>
              <th className="whitespace-nowrap px-3 py-2 font-semibold">Khách hàng</th>
              <th className="whitespace-nowrap px-3 py-2 font-semibold">Vị trí</th>
              <th className="whitespace-nowrap px-3 py-2 font-semibold">Lịch lặp lại</th>
              <th className="whitespace-nowrap px-3 py-2 font-semibold">Hiệu lực</th>
              <th className="whitespace-nowrap px-3 py-2 font-semibold">Tiền cọc</th>
              <th className="whitespace-nowrap px-3 py-2 font-semibold">Trạng thái</th>
              <th className="whitespace-nowrap px-3 py-2 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.map((rule) => {
              const renewalDue = needsRenewalReminder(rule, today);
              return (
                <tr
                  key={rule.id}
                  className={`border-t border-brand-forest/10 ${renewalDue ? "bg-red-50/50" : ""}`}
                >
                  <td className="px-3 py-2 font-medium text-brand-forest">
                    {rule.customer_name}
                    {rule.phone && (
                      <span className="block text-xs font-normal text-brand-forest/60">
                        {rule.phone}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-brand-forest/80">
                    {locationName(rule.location_id)}
                    {rule.seat_number && (
                      <span className="block text-xs text-brand-forest/60">
                        VT {rule.seat_number}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-brand-forest/80">
                    {describeRecurrence(rule)}
                    <span className="block text-xs text-brand-forest/50">
                      {rule.start_time.slice(0, 5)} - {rule.end_time.slice(0, 5)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-brand-forest/80">
                    {formatDateDMY(rule.effective_from)}
                    {rule.effective_until
                      ? ` → ${formatDateDMY(rule.effective_until)}`
                      : " → vô thời hạn"}
                    {renewalDue && (
                      <div className="mt-1 flex flex-col items-start gap-1">
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600">
                          ⚠ Sắp hết hạn — nhắc gia hạn
                        </span>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => openRenew(rule)}
                            className="rounded-lg border border-red-300 px-2 py-0.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                          >
                            Gia hạn
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-brand-forest/80">
                    {rule.deposit_amount > 0 ? formatMoney(rule.deposit_amount) : "-"}
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
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setViewing(rule)}
                        className="text-xs font-semibold text-brand-forest hover:underline"
                      >
                        Xem
                      </button>
                      {canEdit && (
                        <button
                          onClick={() => openEdit(rule)}
                          className="text-xs font-semibold text-brand-forest hover:underline"
                        >
                          Sửa
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => handleDelete(rule.id)}
                          className="text-xs font-semibold text-red-600 hover:underline"
                        >
                          Xóa
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredCustomers.length === 0 && (
          <p className="p-4 text-center text-sm text-brand-forest/50">
            {fixedCustomers.length === 0
              ? "Chưa có khách cố định nào."
              : "Không có khách cố định nào phù hợp với bộ lọc đang chọn."}
          </p>
        )}
      </div>

      {viewing && (
        <FixedCustomerDetailView
          rule={viewing}
          locationName={locationName(viewing.location_id)}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}

function FixedCustomerDetailView({
  rule,
  locationName,
  onClose,
}: {
  rule: FixedCustomer;
  locationName: string;
  onClose: () => void;
}) {
  const [occurrences, setOccurrences] = useState<FixedCustomerOccurrence[] | null>(null);
  const today = ymd(new Date());
  const renewalDue = needsRenewalReminder(rule, today);

  useEffect(() => {
    let cancelled = false;
    getFixedCustomerSchedule(rule.id).then((data) => {
      if (!cancelled) setOccurrences(data);
    });
    return () => {
      cancelled = true;
    };
  }, [rule.id]);

  const allUpcoming = (occurrences ?? []).filter((o) => o.date >= today);
  const upcoming = allUpcoming.slice(0, 20);
  const past = (occurrences ?? [])
    .filter((o) => o.date < today)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-brand-forest">{rule.customer_name}</h2>
            {rule.phone && <p className="text-xs text-brand-forest/60">{rule.phone}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-full p-1 text-brand-forest/60 hover:bg-brand-cream"
          >
            ✕
          </button>
        </div>

        <div className="rounded-lg border border-brand-forest/15 px-4">
          <ReviewRow label="Vị trí" value={locationName} />
          {rule.seat_number && <ReviewRow label="Số vị trí" value={rule.seat_number} />}
          <ReviewRow label="Lặp lại" value={describeRecurrence(rule)} />
          <ReviewRow label="Giờ" value={`${rule.start_time.slice(0, 5)} - ${rule.end_time.slice(0, 5)}`} />
          <ReviewRow
            label="Hiệu lực"
            value={`${formatDateDMY(rule.effective_from)} → ${
              rule.effective_until ? formatDateDMY(rule.effective_until) : "vô thời hạn"
            }`}
          />
          <ReviewRow
            label="Tiền cọc"
            value={rule.deposit_amount > 0 ? formatMoney(rule.deposit_amount) : "-"}
          />
          <ReviewRow label="Trạng thái" value={rule.active ? "Đang áp dụng" : "Tạm ngưng"} />
          <ReviewRow label="Ghi chú" value={rule.note || "-"} />
        </div>

        {renewalDue && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-600">
            ⚠ Sắp hết hạn ({formatDateDMY(rule.effective_until)}) — nhắc khách gia hạn.
          </p>
        )}

        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold text-brand-forest">Lịch đặt của khách</h3>
          {occurrences === null ? (
            <p className="text-sm text-brand-forest/50">Đang tải...</p>
          ) : (
            <div className="flex flex-col gap-3">
              <div>
                <p className="mb-1 text-xs font-medium text-brand-forest/60">
                  Sắp tới ({allUpcoming.length}
                  {allUpcoming.length > upcoming.length ? `, hiện ${upcoming.length} gần nhất` : ""})
                </p>
                {upcoming.length === 0 ? (
                  <p className="text-xs text-brand-forest/40">Không có lịch sắp tới.</p>
                ) : (
                  <ul className="flex flex-wrap gap-1.5">
                    {upcoming.map((o) => (
                      <li
                        key={o.date}
                        className="rounded-full bg-brand-forest/10 px-2 py-0.5 text-xs font-medium text-brand-forest"
                      >
                        {formatDateDMY(o.date)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-brand-forest/60">
                  Đã qua gần đây
                </p>
                {past.length === 0 ? (
                  <p className="text-xs text-brand-forest/40">Chưa có lịch nào đã qua.</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {past.map((o) => (
                      <li
                        key={o.date}
                        className="flex items-center justify-between rounded-lg border border-brand-forest/10 px-2 py-1 text-xs"
                      >
                        <span className="text-brand-forest/80">{formatDateDMY(o.date)}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 font-medium ${
                            o.arrived
                              ? "bg-brand-forest/10 text-brand-forest"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {o.arrived ? "Đã đến" : "Chưa đến"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-brand-forest/30 px-4 py-2 text-sm font-medium text-brand-forest hover:bg-brand-cream"
          >
            Đóng
          </button>
        </div>
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
  const [weekday, setWeekday] = useState<number[]>(rule?.weekday ?? [1]);
  const [daysOfMonth, setDaysOfMonth] = useState<number[]>(rule?.day_of_month ?? []);
  const [customDates, setCustomDates] = useState<string[]>(rule?.custom_dates ?? []);
  const [startTime, setStartTime] = useState(rule?.start_time.slice(0, 5) ?? "09:00");
  const [endTime, setEndTime] = useState(rule?.end_time.slice(0, 5) ?? "11:00");
  const [effectiveFrom, setEffectiveFrom] = useState(
    rule?.effective_from ?? new Date().toISOString().slice(0, 10)
  );
  const [effectiveUntil, setEffectiveUntil] = useState(rule?.effective_until ?? "");
  const [depositAmount, setDepositAmount] = useState(rule?.deposit_amount ?? 0);
  const [active, setActive] = useState(rule?.active ?? true);
  const [note, setNote] = useState(rule?.note ?? "");
  const [seatNumber, setSeatNumber] = useState(rule?.seat_number ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedLocation = locations.find((l) => l.id === locationId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (endTime <= startTime) {
      setError("Giờ kết thúc phải sau giờ bắt đầu.");
      return;
    }
    if (
      (recurrenceType === "ngày cụ thể" || recurrenceType === "hàng năm") &&
      customDates.length === 0
    ) {
      setError(
        recurrenceType === "hàng năm"
          ? "Thêm ít nhất 1 ngày lặp lại mỗi năm."
          : "Thêm ít nhất 1 ngày cụ thể."
      );
      return;
    }
    if (recurrenceType === "hàng tuần" && weekday.length === 0) {
      setError("Chọn ít nhất 1 thứ trong tuần.");
      return;
    }
    if (
      (recurrenceType === "hàng tháng" || recurrenceType === "hàng quý") &&
      daysOfMonth.length === 0
    ) {
      setError("Chọn ít nhất 1 ngày trong tháng.");
      return;
    }

    setLoading(true);

    const input: FixedCustomerInput = {
      location_id: locationId,
      customer_name: customerName,
      phone,
      recurrence_type: recurrenceType,
      weekday: recurrenceType === "hàng tuần" ? weekday : null,
      day_of_month:
        recurrenceType === "hàng tháng" || recurrenceType === "hàng quý"
          ? daysOfMonth
          : null,
      custom_dates:
        recurrenceType === "ngày cụ thể" || recurrenceType === "hàng năm"
          ? customDates
          : null,
      start_time: startTime,
      end_time: endTime,
      effective_from: effectiveFrom,
      effective_until: effectiveUntil || null,
      active,
      deposit_amount: depositAmount,
      note,
      seat_number: selectedLocation?.type === "ghế ngoài" ? seatNumber || null : null,
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

      {selectedLocation?.type === "ghế ngoài" && (
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          onChange={(e) => {
            const newType = e.target.value as RecurrenceType;
            setRecurrenceType(newType);
            setEffectiveUntil(defaultEffectiveUntil(newType, effectiveFrom) ?? "");
          }}
          className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
        >
          <option value="hàng tuần">Hàng tuần</option>
          <option value="hàng tháng">Hàng tháng</option>
          <option value="hàng quý">Hàng quý</option>
          <option value="hàng năm">Hàng năm</option>
          <option value="ngày cụ thể">Ngày cụ thể</option>
        </select>
      </div>

      {recurrenceType === "hàng tuần" && (
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-forest">
            Vào các thứ (có thể chọn nhiều)
          </label>
          <WeekdayPicker value={weekday} onChange={setWeekday} />
        </div>
      )}

      {recurrenceType === "hàng tháng" && (
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-forest">
            Vào các ngày trong tháng (có thể chọn nhiều)
          </label>
          <DayOfMonthPicker value={daysOfMonth} onChange={setDaysOfMonth} />
        </div>
      )}

      {recurrenceType === "hàng quý" && (
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-forest">
            Vào các ngày trong tháng (có thể chọn nhiều), lặp lại mỗi 3 tháng kể từ
            ngày hiệu lực
          </label>
          <DayOfMonthPicker value={daysOfMonth} onChange={setDaysOfMonth} />
        </div>
      )}

      {(recurrenceType === "ngày cụ thể" || recurrenceType === "hàng năm") && (
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-forest">
            {recurrenceType === "hàng năm"
              ? "Các ngày lặp lại mỗi năm (chỉ lấy ngày/tháng, năm không quan trọng)"
              : "Danh sách ngày"}
          </label>
          <DateListPicker
            value={customDates}
            onChange={setCustomDates}
            formatChip={recurrenceType === "hàng năm" ? formatDayMonth : undefined}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
