"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getCheckinList,
  type CheckinRow,
} from "@/lib/actions/booking-history";
import {
  setBookingArrived,
  cancelBooking,
  setDepositRefunded,
} from "@/lib/actions/bookings";
import { setFixedCustomerArrived } from "@/lib/actions/fixed-customer-checkins";
import ExportExcelButton from "@/components/ExportExcelButton";
import type { Database } from "@/lib/types/database";
import BookingForm from "@/components/BookingForm";

type Location = Database["public"]["Tables"]["locations"]["Row"];
type DiscountRule = Database["public"]["Tables"]["discount_rules"]["Row"];
type PricingRule = Database["public"]["Tables"]["pricing_rules"]["Row"];
type PreferredCustomer = Database["public"]["Tables"]["preferred_customers"]["Row"];

function formatTimeRange(startIso: string, endIso: string) {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  return `${fmt(startIso)} - ${fmt(endIso)}`;
}

function formatMoney(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}

/** yyyy-mm-dd in local time (avoids the UTC-shift bug of toISOString()). */
function dateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const RECURRENCE_LABEL: Record<string, string> = {
  "hàng tuần": "Hàng tuần",
  "hàng tháng": "Hàng tháng",
  "hàng quý": "Hàng quý",
  "hàng năm": "Hàng năm",
  "ngày cụ thể": "Ngày cụ thể",
};

function todayStr() {
  return dateStr(new Date());
}

function startOfWeek(d: Date) {
  const monday = new Date(d);
  const day = monday.getDay(); // 0 = Sun ... 6 = Sat
  const diff = day === 0 ? -6 : 1 - day;
  monday.setDate(monday.getDate() + diff);
  return monday;
}

function endOfWeek(d: Date) {
  const sunday = startOfWeek(d);
  sunday.setDate(sunday.getDate() + 6);
  return sunday;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function startOfYear(d: Date) {
  return new Date(d.getFullYear(), 0, 1);
}

function endOfYear(d: Date) {
  return new Date(d.getFullYear(), 11, 31);
}

type QuickFilter =
  | "all"
  | "arrived"
  | "not_arrived"
  | "cancelled"
  | "deposit_pending"
  | "deposit_forfeited"
  | "has_deposit";

function SummaryCard({
  label,
  value,
  tone = "forest",
  active,
  onClick,
}: {
  label: string;
  value: string;
  tone?: "forest" | "amber" | "red";
  active?: boolean;
  onClick?: () => void;
}) {
  const toneClass =
    tone === "amber"
      ? "text-brand-amber"
      : tone === "red"
      ? "text-red-600"
      : "text-brand-forest";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`rounded-xl border bg-white p-4 text-center transition ${
        active
          ? "border-brand-forest ring-2 ring-brand-forest/40"
          : "border-brand-forest/15 hover:border-brand-forest/40"
      } ${onClick ? "cursor-pointer" : "cursor-default"}`}
    >
      <p className="text-xs font-bold text-brand-forest/60">{label}</p>
      <p className={`mt-1 text-xl font-bold ${toneClass}`}>{value}</p>
    </button>
  );
}

export default function CheckInClient({
  initialRows,
  initialDate,
  locations,
  discountRules,
  pricingRules,
  preferredCustomers,
  canEdit,
}: {
  initialRows: CheckinRow[];
  initialDate: string;
  locations: Location[];
  discountRules: DiscountRule[];
  pricingRules: PricingRule[];
  preferredCustomers: PreferredCustomer[];
  canEdit: boolean;
}) {
  const [dateFrom, setDateFrom] = useState(initialDate);
  const [dateTo, setDateTo] = useState(initialDate);
  const [rawQuery, setRawQuery] = useState("");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<CheckinRow[]>(initialRows);
  const [loading, setLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<CheckinRow | null>(null);
  const [activeFilter, setActiveFilter] = useState<QuickFilter>("all");
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => setQuery(rawQuery), 350);
    return () => clearTimeout(timer);
  }, [rawQuery]);

  const refetch = useCallback(async () => {
    setLoading(true);
    const data = await getCheckinList({
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      query: query || undefined,
    });
    setRows(data);
    setLoading(false);
  }, [dateFrom, dateTo, query]);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    refetch();
  }, [refetch]);

  function selectRange(from: Date, to: Date) {
    setDateFrom(dateStr(from));
    setDateTo(dateStr(to));
  }

  function selectToday() {
    const now = new Date();
    selectRange(now, now);
  }

  function selectThisWeek() {
    const now = new Date();
    selectRange(startOfWeek(now), endOfWeek(now));
  }

  function selectThisMonth() {
    const now = new Date();
    selectRange(startOfMonth(now), endOfMonth(now));
  }

  function selectThisYear() {
    const now = new Date();
    selectRange(startOfYear(now), endOfYear(now));
  }

  async function handleToggleArrived(row: CheckinRow) {
    setTogglingId(row.id);
    const arrived = row.status !== "đã tới";
    const result =
      row.is_fixed_customer && row.fixed_customer_id && row.occurrence_date
        ? await setFixedCustomerArrived(row.fixed_customer_id, row.occurrence_date, arrived)
        : await setBookingArrived(row.id, arrived);
    setTogglingId(null);
    if (result.error) {
      alert(result.error);
      return;
    }
    refetch();
  }

  async function handleCancel(row: CheckinRow) {
    if (!confirm(`Xác nhận hủy đặt chỗ của "${row.customer_name}"?`)) return;
    setCancelingId(row.id);
    const result = await cancelBooking(row.id);
    setCancelingId(null);
    if (result.error) {
      alert(result.error);
      return;
    }
    refetch();
  }

  async function handleToggleRefunded(row: CheckinRow) {
    setRefundingId(row.id);
    const result = await setDepositRefunded(row.id, !row.deposit_refunded);
    setRefundingId(null);
    if (result.error) {
      alert(result.error);
      return;
    }
    refetch();
  }

  function toggleFilter(f: QuickFilter) {
    setActiveFilter((prev) => (prev === f ? "all" : f));
  }

  const now = new Date();
  const isToday = dateFrom === todayStr() && dateTo === todayStr();
  const isThisWeek =
    dateFrom === dateStr(startOfWeek(now)) && dateTo === dateStr(endOfWeek(now));
  const isThisMonth =
    dateFrom === dateStr(startOfMonth(now)) && dateTo === dateStr(endOfMonth(now));
  const isThisYear =
    dateFrom === dateStr(startOfYear(now)) && dateTo === dateStr(endOfYear(now));
  const quickValue = isToday
    ? "day"
    : isThisWeek
    ? "week"
    : isThisMonth
    ? "month"
    : isThisYear
    ? "year"
    : "custom";

  const editingLocation = editingRow
    ? locations.find((l) => l.id === editingRow.location_id)
    : null;

  const realBookingRows = rows.filter((r) => !r.is_fixed_customer);
  const cancelledRows = realBookingRows.filter((r) => r.status === "hủy");
  // "Tổng khách đã book" counts every row shown in the list, cancelled included.
  // Arrived/not-arrived are counted separately by status so cancelled rows land in
  // neither bucket (they already have their own "Số khách hủy" card).
  const totalBooked = rows.length;
  const totalArrived = rows.filter((r) => r.status === "đã tới").length;
  const totalNotArrived = rows.filter((r) => r.status === "đã đặt").length;
  // Deposits only apply to real bookings — fixed-customer occurrences never carry one.
  // Deposits already collected count toward the total even if the booking was later cancelled.
  const totalDeposit = realBookingRows.reduce((sum, r) => sum + r.deposit_amount, 0);
  // A cancelled booking's deposit is forfeited, not "pending refund" — kept separate below.
  const totalDepositNotRefunded = realBookingRows
    .filter((r) => r.status !== "hủy" && r.deposit_amount > 0 && !r.deposit_refunded)
    .reduce((sum, r) => sum + r.deposit_amount, 0);
  const totalForfeited = cancelledRows
    .filter((r) => r.deposit_amount > 0)
    .reduce((sum, r) => sum + r.deposit_amount, 0);
  const totalCancelled = cancelledRows.length;

  const filteredRows = rows.filter((r) => {
    switch (activeFilter) {
      case "arrived":
        return r.status === "đã tới";
      case "not_arrived":
        return r.status === "đã đặt";
      case "cancelled":
        return !r.is_fixed_customer && r.status === "hủy";
      case "deposit_pending":
        return (
          !r.is_fixed_customer &&
          r.status !== "hủy" &&
          r.deposit_amount > 0 &&
          !r.deposit_refunded
        );
      case "deposit_forfeited":
        return !r.is_fixed_customer && r.status === "hủy" && r.deposit_amount > 0;
      case "has_deposit":
        return !r.is_fixed_customer && r.deposit_amount > 0;
      default:
        return true;
    }
  });

  const exportRows = filteredRows.map((r) => ({
    Giờ: formatTimeRange(r.start_time, r.end_time),
    "Vị trí": r.location_name,
    "Khách hàng": r.customer_name,
    SĐT: r.phone ?? "",
    "Đối tượng": r.org_type === "công ty/tổ chức" ? "Công ty/Tổ chức" : "Cá nhân",
    "Số người": r.attendee_count ?? "",
    "Đặt cọc": r.deposit_amount,
    "Hoàn cọc":
      r.deposit_amount <= 0
        ? ""
        : r.status === "hủy"
        ? "Bỏ cọc"
        : r.deposit_refunded
        ? "Đã hoàn"
        : "Chưa hoàn",
    "Ghi chú": r.note ?? "",
    "Trạng thái": r.is_fixed_customer
      ? `Khách cố định (${RECURRENCE_LABEL[r.recurrence_type ?? ""] ?? ""})`
      : r.status === "hủy"
      ? "Đã hủy"
      : r.status === "đã tới"
      ? "Đã đến"
      : "Chưa đến",
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
        <SummaryCard
          label="Tổng khách đã book"
          value={String(totalBooked)}
          active={activeFilter === "all"}
          onClick={() => toggleFilter("all")}
        />
        <SummaryCard
          label="Đã đến"
          value={String(totalArrived)}
          active={activeFilter === "arrived"}
          onClick={() => toggleFilter("arrived")}
        />
        <SummaryCard
          label="Chưa đến"
          value={String(totalNotArrived)}
          tone="amber"
          active={activeFilter === "not_arrived"}
          onClick={() => toggleFilter("not_arrived")}
        />
        <SummaryCard
          label="Số khách hủy"
          value={String(totalCancelled)}
          tone="red"
          active={activeFilter === "cancelled"}
          onClick={() => toggleFilter("cancelled")}
        />
        <SummaryCard
          label="Cọc chưa hoàn"
          value={formatMoney(totalDepositNotRefunded)}
          tone="amber"
          active={activeFilter === "deposit_pending"}
          onClick={() => toggleFilter("deposit_pending")}
        />
        <SummaryCard
          label="Tiền khách bỏ cọc"
          value={formatMoney(totalForfeited)}
          tone="red"
          active={activeFilter === "deposit_forfeited"}
          onClick={() => toggleFilter("deposit_forfeited")}
        />
        <SummaryCard
          label="Tổng tiền đã cọc"
          value={formatMoney(totalDeposit)}
          active={activeFilter === "has_deposit"}
          onClick={() => toggleFilter("has_deposit")}
        />
      </div>
      {activeFilter !== "all" && (
        <p className="-mt-2 text-xs font-medium text-brand-forest/60">
          Đang lọc theo mục đã chọn ở trên — bấm lại vào thẻ đó để bỏ lọc.
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-brand-forest/15 bg-white p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-brand-forest/70">Xem nhanh</label>
          <select
            value={quickValue}
            onChange={(e) => {
              const value = e.target.value;
              if (value === "day") selectToday();
              else if (value === "week") selectThisWeek();
              else if (value === "month") selectThisMonth();
              else if (value === "year") selectThisYear();
            }}
            className="rounded-lg border border-brand-forest/30 px-3 py-1.5 text-sm font-bold text-brand-forest outline-none focus:border-brand-amber"
          >
            <option value="day">Khách book trong ngày</option>
            <option value="week">Khách book trong tuần</option>
            <option value="month">Khách book trong tháng</option>
            <option value="year">Khách book trong năm</option>
            {quickValue === "custom" && <option value="custom">Tùy chỉnh</option>}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-brand-forest/70">
            Tìm khách/SĐT
          </label>
          <input
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
            placeholder="Tên hoặc SĐT"
            className="rounded-lg border border-brand-forest/30 px-3 py-1.5 text-sm outline-none focus:border-brand-amber"
          />
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
        <div className="ml-auto">
          <ExportExcelButton
            filename={`khach-da-booking_${dateFrom}_${dateTo}`}
            rows={exportRows}
            sheetName="Khách đã booking"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-brand-forest/15 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-brand-cream text-brand-forest/70">
            <tr>
              <th className="whitespace-nowrap px-3 py-2 font-semibold">Giờ</th>
              <th className="whitespace-nowrap px-3 py-2 font-semibold">Vị trí</th>
              <th className="whitespace-nowrap px-3 py-2 font-semibold">Khách hàng</th>
              <th className="whitespace-nowrap px-3 py-2 font-semibold">SĐT</th>
              <th className="whitespace-nowrap px-3 py-2 text-center font-semibold">Đối tượng</th>
              <th className="whitespace-nowrap px-3 py-2 text-center font-semibold">Số người</th>
              <th className="whitespace-nowrap px-3 py-2 text-center font-semibold">Đặt cọc</th>
              <th className="whitespace-nowrap px-3 py-2 font-semibold">Ghi chú</th>
              <th className="whitespace-nowrap px-3 py-2 text-center font-semibold">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => {
              const arrived = r.status === "đã tới";
              const cancelled = r.status === "hủy";
              return (
                <tr
                  key={r.id}
                  className={`border-t border-brand-forest/10 ${
                    cancelled ? "opacity-60" : arrived ? "bg-brand-forest/5" : ""
                  }`}
                >
                  <td className="px-3 py-2 font-medium text-brand-forest">
                    {formatTimeRange(r.start_time, r.end_time)}
                  </td>
                  <td className="px-3 py-2 text-brand-forest/80">{r.location_name}</td>
                  <td className="px-3 py-2 font-medium">
                    {r.is_fixed_customer ? (
                      <button
                        onClick={() =>
                          router.push(`/fixed-customers?edit=${r.fixed_customer_id}`)
                        }
                        className="text-brand-forest hover:underline"
                      >
                        {r.customer_name}
                      </button>
                    ) : (
                      <button
                        onClick={() => setEditingRow(r)}
                        className="text-brand-forest hover:underline"
                      >
                        {r.customer_name}
                      </button>
                    )}
                    {r.is_fixed_customer && r.recurrence_type && (
                      <span className="block text-xs font-normal text-brand-forest/60">
                        Khách cố định · {RECURRENCE_LABEL[r.recurrence_type] ?? r.recurrence_type}
                      </span>
                    )}
                    {r.organization_name && (
                      <span className="block text-xs font-normal text-brand-forest/60">
                        {r.organization_name}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-brand-forest/80">{r.phone || "-"}</td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.org_type === "công ty/tổ chức"
                          ? "bg-brand-forest/10 text-brand-forest"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {r.org_type === "công ty/tổ chức" ? "Công ty/Tổ chức" : "Cá nhân"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center text-brand-forest/80">
                    {r.attendee_count ?? "-"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex flex-col items-center gap-1">
                      {r.deposit_amount > 0 ? (
                        <span className="rounded-full bg-brand-forest/10 px-2 py-0.5 text-xs font-bold text-brand-forest">
                          {formatMoney(r.deposit_amount)}
                        </span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                          Chưa cọc
                        </span>
                      )}
                      {r.deposit_amount > 0 && !r.is_fixed_customer && (
                        cancelled ? (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-600">
                            Bỏ cọc
                          </span>
                        ) : (
                          <label
                            className={`flex items-center gap-1 text-[11px] font-bold ${
                              canEdit ? "cursor-pointer" : "cursor-default opacity-60"
                            } ${r.deposit_refunded ? "text-brand-forest" : "text-brand-amber"}`}
                          >
                            <input
                              type="checkbox"
                              checked={r.deposit_refunded}
                              disabled={!canEdit || refundingId === r.id}
                              onChange={() => handleToggleRefunded(r)}
                              className="h-3.5 w-3.5 accent-brand-forest"
                            />
                            {r.deposit_refunded ? "Đã hoàn" : "Chưa hoàn"}
                          </label>
                        )
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-brand-forest/60">{r.note || "-"}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col items-center gap-1">
                      {cancelled ? (
                        <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-bold text-gray-600">
                          Đã hủy
                        </span>
                      ) : (
                        <>
                          <label
                            className={`flex items-center gap-1.5 text-xs font-bold ${
                              canEdit ? "cursor-pointer" : "cursor-default opacity-60"
                            } ${arrived ? "text-brand-forest" : "text-brand-amber"}`}
                          >
                            <input
                              type="checkbox"
                              checked={arrived}
                              disabled={!canEdit || togglingId === r.id}
                              onChange={() => handleToggleArrived(r)}
                              className="h-4 w-4 accent-brand-forest"
                            />
                            {arrived ? "Đã đến" : "Chưa đến"}
                          </label>
                          {canEdit && !r.is_fixed_customer && (
                            <button
                              onClick={() => handleCancel(r)}
                              disabled={cancelingId === r.id}
                              className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
                            >
                              Hủy đặt chỗ
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && filteredRows.length === 0 && (
          <p className="p-4 text-center text-sm text-brand-forest/50">
            {rows.length === 0
              ? "Không có khách đặt lịch trong khoảng thời gian này."
              : "Không có khách phù hợp với bộ lọc đang chọn."}
          </p>
        )}
        {loading && (
          <p className="p-4 text-center text-sm text-brand-forest/50">Đang tải...</p>
        )}
      </div>

      {editingRow && editingLocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <BookingForm
              location={editingLocation}
              booking={editingRow}
              discountRules={discountRules}
              pricingRules={pricingRules}
              preferredCustomers={preferredCustomers}
              canEdit={canEdit}
              onDone={() => {
                setEditingRow(null);
                refetch();
              }}
              onCancelForm={() => setEditingRow(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
