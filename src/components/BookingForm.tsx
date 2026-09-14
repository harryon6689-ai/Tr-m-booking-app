"use client";

import { useState } from "react";
import type {
  BookingStatus,
  CustomerOrgType,
  CustomerType,
  Database,
} from "@/lib/types/database";
import { EQUIPMENT_OPTIONS } from "@/lib/types/database";
import { createBooking, updateBooking, cancelBooking } from "@/lib/actions/bookings";
import {
  createFixedCustomer,
  type FixedCustomerInput,
} from "@/lib/actions/fixed-customers";
import CurrencyInput from "@/components/CurrencyInput";
import ReviewRow from "@/components/ReviewRow";
import WeekdayPicker from "@/components/WeekdayPicker";
import DayOfMonthPicker from "@/components/DayOfMonthPicker";
import DateListPicker from "@/components/DateListPicker";
import {
  formatPricingRule,
  formatAttendeeRange,
  computeSuggestedPrice,
  matchingPricingRules,
} from "@/lib/pricing-rules-utils";
import {
  defaultEffectiveUntil,
  formatDateDMY,
  formatDayMonth,
  ymd,
} from "@/lib/fixed-customers-utils";
import {
  type EntryType,
  ENTRY_TYPE_OPTIONS,
  entryTypeLabel,
  entryTypeToRecurrenceType,
  recurrenceLabel,
} from "@/lib/recurrence-entry-type";

type Booking = Database["public"]["Tables"]["bookings"]["Row"];
type Location = Database["public"]["Tables"]["locations"]["Row"];
type DiscountRule = Database["public"]["Tables"]["discount_rules"]["Row"];
type PricingRule = Database["public"]["Tables"]["pricing_rules"]["Row"];
type PreferredCustomer = Database["public"]["Tables"]["preferred_customers"]["Row"];

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function formatLocalInput(value: string) {
  if (!value) return "-";
  const d = new Date(value);
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function defaultTimes(baseDate: Date, startHour = 9, endHour = 10) {
  const start = new Date(baseDate);
  start.setHours(startHour, 0, 0, 0);
  const end = new Date(baseDate);
  end.setHours(endHour, 0, 0, 0);
  return {
    start: toLocalInput(start.toISOString()),
    end: toLocalInput(end.toISOString()),
  };
}

export default function BookingForm({
  location,
  booking,
  discountRules,
  pricingRules,
  preferredCustomers,
  defaultDate,
  defaultStartHour,
  defaultEndHour,
  canEdit = true,
  isAdmin = false,
  onDone,
  onCancelForm,
}: {
  location: Location;
  booking: Booking | null;
  discountRules: DiscountRule[];
  pricingRules: PricingRule[];
  preferredCustomers: PreferredCustomer[];
  defaultDate?: Date;
  defaultStartHour?: number;
  defaultEndHour?: number;
  canEdit?: boolean;
  isAdmin?: boolean;
  onDone: () => void;
  onCancelForm: () => void;
}) {
  const defaults = defaultTimes(defaultDate ?? new Date(), defaultStartHour, defaultEndHour);
  const recurBaseDate = defaultDate ?? new Date();

  const [entryType, setEntryType] = useState<EntryType>("single");
  const [recurStartDate, setRecurStartDate] = useState(ymd(recurBaseDate));
  const [recurStartTime, setRecurStartTime] = useState(
    `${String(defaultStartHour ?? 9).padStart(2, "0")}:00`
  );
  const [recurEndTime, setRecurEndTime] = useState(
    `${String(defaultEndHour ?? 10).padStart(2, "0")}:00`
  );
  const [weekdays, setWeekdays] = useState<number[]>([recurBaseDate.getDay()]);
  const [monthDays, setMonthDays] = useState<number[]>([recurBaseDate.getDate()]);
  const [yearDates, setYearDates] = useState<string[]>([ymd(recurBaseDate)]);
  const [effectiveUntil, setEffectiveUntil] = useState("");

  const [customerName, setCustomerName] = useState(booking?.customer_name ?? "");
  const [phone, setPhone] = useState(booking?.phone ?? "");
  const [orgType, setOrgType] = useState<CustomerOrgType>(booking?.org_type ?? "cá nhân");
  const [organizationName, setOrganizationName] = useState(
    booking?.organization_name ?? ""
  );
  const [attendeeCount, setAttendeeCount] = useState<string>(
    booking?.attendee_count != null ? String(booking.attendee_count) : ""
  );
  const [startTime, setStartTime] = useState(
    booking ? toLocalInput(booking.start_time) : defaults.start
  );
  const [endTime, setEndTime] = useState(
    booking ? toLocalInput(booking.end_time) : defaults.end
  );
  const [customerType, setCustomerType] = useState<CustomerType>("thường");
  const [discountApplied, setDiscountApplied] = useState(
    booking?.discount_applied ?? 0
  );
  const [depositAmount, setDepositAmount] = useState(booking?.deposit_amount ?? 0);
  const [pricingRuleId, setPricingRuleId] = useState<string | null>(
    booking?.pricing_rule_id ?? null
  );
  const [equipmentNeeded, setEquipmentNeeded] = useState<string[]>(
    booking?.equipment_needed ?? []
  );
  const [equipmentNote, setEquipmentNote] = useState(booking?.equipment_note ?? "");
  const [status, setStatus] = useState<BookingStatus>(booking?.status ?? "đã đặt");
  const [vatInvoiceRequested, setVatInvoiceRequested] = useState(
    booking?.vat_invoice_requested ?? false
  );
  const [vatCompanyName, setVatCompanyName] = useState(booking?.vat_company_name ?? "");
  const [vatCompanyAddress, setVatCompanyAddress] = useState(
    booking?.vat_company_address ?? ""
  );
  const [vatTaxCode, setVatTaxCode] = useState(booking?.vat_tax_code ?? "");
  const [vatEmail, setVatEmail] = useState(booking?.vat_email ?? "");
  const [actualDrinkSpend, setActualDrinkSpend] = useState(
    booking?.actual_drink_spend ?? 0
  );
  const [note, setNote] = useState(booking?.note ?? "");
  const [seatNumber, setSeatNumber] = useState(booking?.seat_number ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "review" | "success">("form");
  const [appliedPreferredId, setAppliedPreferredId] = useState<string | null>(null);
  const [dismissedPreferredId, setDismissedPreferredId] = useState<string | null>(null);

  const matchedPreferredCustomer = (() => {
    const phoneTrim = phone.trim();
    if (phoneTrim) {
      const byPhone = preferredCustomers.find(
        (p) => p.phone && p.phone.trim() === phoneTrim
      );
      if (byPhone) return byPhone;
    }
    const nameTrim = customerName.trim().toLowerCase();
    if (nameTrim) {
      const byName = preferredCustomers.find(
        (p) => p.name.trim().toLowerCase() === nameTrim
      );
      if (byName) return byName;
    }
    return null;
  })();

  function applyPreferredCustomer(p: PreferredCustomer) {
    setCustomerName(p.name);
    if (p.phone) setPhone(p.phone);
    setOrgType(p.org_type);
    setOrganizationName(p.organization_name ?? "");
    setCustomerType(p.customer_type === "KOL" ? "KOL" : "VIP");

    const percent =
      p.custom_discount_percent != null
        ? Number(p.custom_discount_percent)
        : Number(
            discountRules.find(
              (r) => r.customer_type === p.customer_type && r.discount_type === "phòng"
            )?.default_percent ?? 0
          );
    setDiscountApplied(percent);
    setEquipmentNeeded(p.equipment_needed ?? []);
    setEquipmentNote(p.equipment_note ?? "");
    setAppliedPreferredId(p.id);
  }

  function applyCustomerType(type: CustomerType) {
    setCustomerType(type);
    const rule = discountRules.find(
      (r) => r.customer_type === type && r.discount_type === "phòng"
    );
    if (rule) setDiscountApplied(Number(rule.default_percent));
  }

  function toggleEquipment(item: string) {
    setEquipmentNeeded((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  }

  const suggestedRules = matchingPricingRules(
    pricingRules,
    location.type,
    attendeeCount ? Number(attendeeCount) : null
  );

  const durationHours =
    startTime && endTime
      ? Math.max(0, (new Date(endTime).getTime() - new Date(startTime).getTime()) / 3_600_000)
      : 0;
  const overageHours = Math.max(0, durationHours - location.included_hours);
  const overageFee =
    overageHours > 0 ? overageHours * (location.overage_fee_per_hour ?? 0) : 0;

  function applyPricingRule(rule: PricingRule) {
    setPricingRuleId(rule.id);
  }

  function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (entryType === "single") {
      if (new Date(endTime) <= new Date(startTime)) {
        setError("Giờ kết thúc phải sau giờ bắt đầu.");
        return;
      }
      if (
        vatInvoiceRequested &&
        (!vatCompanyName.trim() || !vatCompanyAddress.trim() || !vatTaxCode.trim() || !vatEmail.trim())
      ) {
        setError("Nhập đủ thông tin xuất hoá đơn VAT (tên công ty, địa chỉ, mã số thuế, email).");
        return;
      }
    } else {
      if (recurEndTime <= recurStartTime) {
        setError("Giờ kết thúc phải sau giờ bắt đầu.");
        return;
      }
      if (entryType === "weekly" && weekdays.length === 0) {
        setError("Chọn ít nhất 1 thứ trong tuần.");
        return;
      }
      if (
        (entryType === "monthly" || entryType === "quarterly") &&
        monthDays.length === 0
      ) {
        setError("Chọn ít nhất 1 ngày trong tháng.");
        return;
      }
      if (entryType === "yearly" && yearDates.length === 0) {
        setError("Thêm ít nhất 1 ngày lặp lại mỗi năm.");
        return;
      }
    }

    setStep("review");
  }

  async function handleConfirm() {
    setError(null);
    setLoading(true);

    if (entryType === "single") {
      const input = {
        location_id: location.id,
        customer_name: customerName,
        phone,
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        status,
        deposit_amount: depositAmount,
        discount_applied: discountApplied,
        final_price: 0,
        overage_fee: overageFee,
        overage_fee_paid: booking?.overage_fee_paid ?? false,
        minimum_spend_shortfall_paid: booking?.minimum_spend_shortfall_paid ?? false,
        note,
        org_type: orgType,
        organization_name: orgType === "công ty/tổ chức" ? organizationName : null,
        attendee_count: attendeeCount ? Number(attendeeCount) : null,
        equipment_needed: equipmentNeeded,
        equipment_note: equipmentNote,
        pricing_rule_id: pricingRuleId,
        vat_invoice_requested: vatInvoiceRequested,
        vat_company_name: vatInvoiceRequested ? vatCompanyName : null,
        vat_company_address: vatInvoiceRequested ? vatCompanyAddress : null,
        vat_tax_code: vatInvoiceRequested ? vatTaxCode : null,
        vat_email: vatInvoiceRequested ? vatEmail : null,
        actual_drink_spend: actualDrinkSpend,
        seat_number: location.type === "ghế ngoài" ? seatNumber || null : null,
      };

      const result = booking
        ? await updateBooking(booking.id, input)
        : await createBooking(input);

      setLoading(false);

      if (result.error) {
        setError(result.error);
        return;
      }
    } else {
      const recurrenceType = entryTypeToRecurrenceType(entryType)!;

      const input: FixedCustomerInput = {
        location_id: location.id,
        customer_name: customerName,
        phone,
        recurrence_type: recurrenceType,
        weekday: recurrenceType === "hàng tuần" ? weekdays : null,
        day_of_month:
          recurrenceType === "hàng tháng" || recurrenceType === "hàng quý"
            ? monthDays
            : null,
        custom_dates: recurrenceType === "hàng năm" ? yearDates : null,
        start_time: recurStartTime,
        end_time: recurEndTime,
        effective_from: recurStartDate,
        effective_until: effectiveUntil || null,
        active: true,
        deposit_amount: 0,
        note,
        seat_number: location.type === "ghế ngoài" ? seatNumber || null : null,
      };

      const result = await createFixedCustomer(input);
      setLoading(false);

      if (result.error) {
        setError(result.error);
        return;
      }
    }

    setStep("success");
  }

  async function handleCancelBooking() {
    if (!booking) return;
    if (!confirm("Xác nhận hủy đặt chỗ này?")) return;
    setLoading(true);
    const result = await cancelBooking(booking.id);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onDone();
  }

  if (step === "success") {
    return (
      <div className="flex flex-col items-center gap-4 p-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-forest/10 text-3xl text-brand-forest">
          ✓
        </div>
        <div>
          <p className="text-lg font-bold text-brand-forest">
            {entryType === "single"
              ? booking
                ? "Cập nhật đặt chỗ thành công!"
                : "Đặt lịch thành công!"
              : "Đã tạo lịch định kỳ thành công!"}
          </p>
          <p className="mt-1 text-sm text-brand-forest/70">
            {entryType === "single" ? (
              <>
                Đã {booking ? "cập nhật" : "đặt chỗ cho"} &quot;{customerName}&quot; tại{" "}
                {location.name}, {formatLocalInput(startTime)} - {formatLocalInput(endTime)}.
              </>
            ) : (
              <>
                Đã tạo lịch định kỳ cho &quot;{customerName}&quot; tại {location.name} —{" "}
                {recurrenceLabel(entryType, recurStartDate, weekdays, monthDays, yearDates)}.
              </>
            )}
          </p>
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

  if (step === "review") {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm font-medium text-brand-forest/70">
          Kiểm tra lại thông tin trước khi xác nhận
        </p>

        <div className="rounded-lg border border-brand-forest/15 px-4">
          <ReviewRow label="Kiểu đặt" value={entryTypeLabel(entryType)} />
          <ReviewRow label="Vị trí" value={location.name} />
          <ReviewRow label="Tên khách" value={customerName} />
          {entryType === "single" && (
            <>
              <ReviewRow
                label="Khách hàng là"
                value={orgType === "công ty/tổ chức" ? "Công ty/Tổ chức" : "Cá nhân"}
              />
              {orgType === "công ty/tổ chức" && (
                <ReviewRow label="Tên công ty/tổ chức" value={organizationName || "-"} />
              )}
            </>
          )}
          <ReviewRow label="Số điện thoại" value={phone || "-"} />
          {location.type === "ghế ngoài" && (
            <ReviewRow label="Số vị trí" value={seatNumber || "-"} />
          )}
          {entryType === "single" ? (
            <>
              <ReviewRow label="Giờ bắt đầu" value={formatLocalInput(startTime)} />
              <ReviewRow label="Giờ kết thúc" value={formatLocalInput(endTime)} />
              <ReviewRow label="Số người tham gia" value={attendeeCount || "-"} />
              <ReviewRow label="Hạng khách" value={customerType} />
              <ReviewRow label="Giảm giá" value={`${discountApplied}%`} />
              <ReviewRow label="Tiền cọc" value={`${depositAmount.toLocaleString("vi-VN")}đ`} />
              {overageFee > 0 && (
                <ReviewRow
                  label="Phụ thu thêm giờ"
                  value={`${overageFee.toLocaleString("vi-VN")}đ (vượt ${overageHours.toFixed(1)}h)`}
                />
              )}
              {equipmentNeeded.length > 0 && (
                <ReviewRow label="Thiết bị" value={equipmentNeeded.join(", ")} />
              )}
              {equipmentNote && <ReviewRow label="Thiết bị khác" value={equipmentNote} />}
              {location.minimum_spend != null && location.minimum_spend > 0 && (
                <>
                  <ReviewRow
                    label="Tiền đồ uống thực tế"
                    value={`${actualDrinkSpend.toLocaleString("vi-VN")}đ`}
                  />
                  <ReviewRow
                    label="Cần thanh toán thêm"
                    value={`${Math.max(0, location.minimum_spend - actualDrinkSpend).toLocaleString("vi-VN")}đ`}
                  />
                </>
              )}
              <ReviewRow
                label="Xuất hoá đơn VAT"
                value={vatInvoiceRequested ? "Có" : "Không"}
              />
              {vatInvoiceRequested && (
                <>
                  <ReviewRow label="Tên công ty" value={vatCompanyName} />
                  <ReviewRow label="Địa chỉ" value={vatCompanyAddress} />
                  <ReviewRow label="Mã số thuế" value={vatTaxCode} />
                  <ReviewRow label="Email" value={vatEmail} />
                </>
              )}
              <ReviewRow
                label="Trạng thái"
                value={status === "đã tới" ? "Đã tới" : status === "hủy" ? "Hủy" : "Đã đặt"}
              />
            </>
          ) : (
            <>
              <ReviewRow label="Bắt đầu từ ngày" value={formatDateDMY(recurStartDate)} />
              <ReviewRow
                label="Lặp lại"
                value={recurrenceLabel(entryType, recurStartDate, weekdays, monthDays, yearDates)}
              />
              <ReviewRow
                label="Hiệu lực đến"
                value={effectiveUntil ? formatDateDMY(effectiveUntil) : "Vô thời hạn"}
              />
              <ReviewRow label="Giờ" value={`${recurStartTime} - ${recurEndTime}`} />
            </>
          )}
          <ReviewRow label="Ghi chú" value={note || "-"} />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="mt-2 flex justify-between">
          <button
            type="button"
            onClick={() => setStep("form")}
            disabled={loading}
            className="rounded-lg border border-brand-forest/30 px-4 py-2 font-medium text-brand-forest hover:bg-brand-cream disabled:opacity-60"
          >
            Sửa lại
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading || !canEdit}
            className="rounded-lg bg-brand-amber px-5 py-2 font-bold text-white hover:bg-brand-amber/90 disabled:opacity-60"
          >
            {loading ? "Đang lưu..." : "Xác nhận"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleContinue} className="flex flex-col gap-3">
      {!canEdit && (
        <p className="rounded-lg bg-brand-forest/10 px-3 py-2 text-xs font-medium text-brand-forest/70">
          Tài khoản chỉ xem — bạn có thể xem chi tiết nhưng không thể tạo/sửa/hủy đặt chỗ.
        </p>
      )}
      <fieldset disabled={!canEdit} className="contents">
      {!booking && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-brand-forest">
            Kiểu đặt
          </label>
          <div className="flex flex-wrap gap-1.5">
            {ENTRY_TYPE_OPTIONS.filter((o) => !o.adminOnly || isAdmin).map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  setEntryType(o.value);
                  const recurrenceType = entryTypeToRecurrenceType(o.value);
                  setEffectiveUntil(
                    recurrenceType
                      ? defaultEffectiveUntil(recurrenceType, recurStartDate) ?? ""
                      : ""
                  );
                }}
                className={`rounded-lg px-3 py-1.5 text-sm font-bold transition ${
                  entryType === o.value
                    ? "bg-brand-forest text-brand-cream"
                    : "border border-brand-forest/30 text-brand-forest hover:bg-brand-cream"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
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

      {entryType === "single" &&
        matchedPreferredCustomer &&
        matchedPreferredCustomer.id !== appliedPreferredId &&
        matchedPreferredCustomer.id !== dismissedPreferredId && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-brand-amber bg-brand-amber/10 p-3">
            <div>
              <p className="text-sm font-bold text-brand-forest">
                ⭐ Khách {matchedPreferredCustomer.customer_type}: {matchedPreferredCustomer.name}
              </p>
              <p className="text-xs text-brand-forest/70">
                {matchedPreferredCustomer.custom_discount_percent != null
                  ? `Chính sách riêng: giảm ${matchedPreferredCustomer.custom_discount_percent}%`
                  : `Áp dụng mức giảm giá mặc định hạng ${matchedPreferredCustomer.customer_type}`}
                {matchedPreferredCustomer.note ? ` · ${matchedPreferredCustomer.note}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setDismissedPreferredId(matchedPreferredCustomer.id)}
                className="rounded-lg border border-brand-forest/30 px-2 py-1 text-xs font-semibold text-brand-forest hover:bg-white"
              >
                Bỏ qua
              </button>
              <button
                type="button"
                onClick={() => applyPreferredCustomer(matchedPreferredCustomer)}
                className="rounded-lg bg-brand-amber px-3 py-1 text-xs font-bold text-white hover:bg-brand-amber/90"
              >
                Dùng thông tin này
              </button>
            </div>
          </div>
        )}

      {entryType === "single" && matchedPreferredCustomer && matchedPreferredCustomer.id === appliedPreferredId && (
        <p className="text-xs font-medium text-brand-forest/70">
          ✓ Đã áp dụng hồ sơ khách {matchedPreferredCustomer.customer_type}:{" "}
          {matchedPreferredCustomer.name}
        </p>
      )}

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

      {location.type === "ghế ngoài" && (
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

      {entryType === "single" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        </div>
      )}

      {entryType === "single" && orgType === "công ty/tổ chức" && (
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

      {entryType === "single" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-brand-forest">
              Giờ bắt đầu
            </label>
            <input
              type="datetime-local"
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
              type="datetime-local"
              required
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
            />
          </div>
        </div>
      )}

      {entryType !== "single" && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-brand-forest">
                Bắt đầu từ ngày
              </label>
              <input
                type="date"
                required
                value={recurStartDate}
                onChange={(e) => setRecurStartDate(e.target.value)}
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
                value={recurStartTime}
                onChange={(e) => setRecurStartTime(e.target.value)}
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
                value={recurEndTime}
                onChange={(e) => setRecurEndTime(e.target.value)}
                className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
              />
            </div>
          </div>

          {entryType === "weekly" && (
            <div>
              <label className="mb-1 block text-sm font-medium text-brand-forest">
                Vào các thứ (có thể chọn nhiều)
              </label>
              <WeekdayPicker value={weekdays} onChange={setWeekdays} />
            </div>
          )}

          {(entryType === "monthly" || entryType === "quarterly") && (
            <div>
              <label className="mb-1 block text-sm font-medium text-brand-forest">
                Vào các ngày trong tháng (có thể chọn nhiều)
              </label>
              <DayOfMonthPicker value={monthDays} onChange={setMonthDays} />
            </div>
          )}

          {entryType === "yearly" && (
            <div>
              <label className="mb-1 block text-sm font-medium text-brand-forest">
                Các ngày lặp lại mỗi năm (chỉ lấy ngày/tháng, năm không quan trọng)
              </label>
              <DateListPicker value={yearDates} onChange={setYearDates} formatChip={formatDayMonth} />
            </div>
          )}

          <p className="rounded-lg bg-brand-cream px-3 py-2 text-xs font-medium text-brand-forest">
            {recurrenceLabel(entryType, recurStartDate, weekdays, monthDays, yearDates)}
          </p>
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
        </>
      )}

      {entryType === "single" && location.minimum_spend != null && location.minimum_spend > 0 && (
        <div className="rounded-lg border border-brand-forest/15 bg-brand-cream/40 p-3">
          <p className="text-xs font-medium text-brand-forest">
            Mức chi tối thiểu đồ uống của vị trí này:{" "}
            <span className="font-bold">
              {location.minimum_spend.toLocaleString("vi-VN")}đ
            </span>
          </p>
          <div className="mt-2">
            <label className="mb-1 block text-sm font-medium text-brand-forest">
              Tổng tiền khách đã thanh toán đồ uống
            </label>
            <CurrencyInput
              value={actualDrinkSpend}
              onChange={setActualDrinkSpend}
              className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
            />
          </div>
          {actualDrinkSpend < location.minimum_spend && (
            <p className="mt-2 text-sm font-bold text-red-600">
              Khách cần thanh toán thêm:{" "}
              {(location.minimum_spend - actualDrinkSpend).toLocaleString("vi-VN")}đ
            </p>
          )}
        </div>
      )}

      {entryType === "single" && suggestedRules.length > 0 && (
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-forest">
            Chính sách giá gợi ý
          </label>
          <div className="flex flex-col gap-2">
            {suggestedRules.map((rule) => {
              const preview = computeSuggestedPrice(rule, startTime, endTime);
              const selected = pricingRuleId === rule.id;
              return (
                <div
                  key={rule.id}
                  className={`flex items-center justify-between gap-2 rounded-lg border p-2 ${
                    selected ? "border-brand-amber bg-brand-amber/10" : "border-brand-forest/20"
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium text-brand-forest">{rule.rule_name}</p>
                    <p className="text-xs text-brand-forest/60">
                      {formatAttendeeRange(rule)} · {formatPricingRule(rule)}
                      {rule.requires_drink_per_person && " · Yêu cầu 1 đồ uống/người"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-bold text-brand-amber">
                      {preview.toLocaleString("vi-VN")}đ
                    </span>
                    <button
                      type="button"
                      onClick={() => applyPricingRule(rule)}
                      className="rounded-lg border border-brand-forest/30 px-2 py-1 text-xs font-semibold text-brand-forest hover:bg-brand-cream"
                    >
                      Áp dụng
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {entryType === "single" && (
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-forest">
            Hạng khách (để tự điền % giảm giá)
          </label>
          <select
            value={customerType}
            onChange={(e) => applyCustomerType(e.target.value as CustomerType)}
            className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
          >
            <option value="thường">Thường</option>
            <option value="VIP">VIP</option>
            <option value="KOL">KOL</option>
          </select>
        </div>
      )}

      {entryType === "single" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-brand-forest">
              Giảm giá (%)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={discountApplied === 0 ? "" : discountApplied}
              onChange={(e) =>
                setDiscountApplied(e.target.value === "" ? 0 : Number(e.target.value))
              }
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
      )}

      {entryType === "single" && overageHours > 0 && (
        <p className="rounded-lg bg-brand-cream px-3 py-2 text-xs font-medium text-brand-forest">
          Thời lượng đặt chỗ vượt <span className="font-bold">{location.included_hours}h</span>{" "}
          quy định {overageHours.toFixed(1)}h — phụ thu thêm giờ tự tính:{" "}
          <span className="font-bold">{overageFee.toLocaleString("vi-VN")}đ</span>.
        </p>
      )}

      {entryType === "single" && (
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-forest">
            Thiết bị cần chuẩn bị
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
      )}

      {entryType === "single" && (
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-brand-forest">
            <input
            type="checkbox"
            checked={vatInvoiceRequested}
            onChange={(e) => setVatInvoiceRequested(e.target.checked)}
          />
          Xuất hoá đơn VAT
        </label>
        {vatInvoiceRequested && (
          <div className="mt-2 grid grid-cols-1 gap-3 rounded-lg border border-brand-forest/15 bg-brand-cream/40 p-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-brand-forest">
                Tên công ty
              </label>
              <input
                required={vatInvoiceRequested}
                value={vatCompanyName}
                onChange={(e) => setVatCompanyName(e.target.value)}
                className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-brand-forest">
                Mã số thuế
              </label>
              <input
                required={vatInvoiceRequested}
                value={vatTaxCode}
                onChange={(e) => setVatTaxCode(e.target.value)}
                className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-brand-forest">
                Địa chỉ
              </label>
              <input
                required={vatInvoiceRequested}
                value={vatCompanyAddress}
                onChange={(e) => setVatCompanyAddress(e.target.value)}
                className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-brand-forest">
                Địa chỉ Email
              </label>
              <input
                type="email"
                required={vatInvoiceRequested}
                value={vatEmail}
                onChange={(e) => setVatEmail(e.target.value)}
                className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
              />
            </div>
          </div>
        )}
        </div>
      )}

      {entryType === "single" && (
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-forest">
            Trạng thái
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as BookingStatus)}
            className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
          >
            <option value="đã đặt">Đã đặt</option>
            <option value="đã tới">Đã tới</option>
            <option value="hủy">Hủy</option>
          </select>
        </div>
      )}

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

      </fieldset>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onCancelForm}
          className="rounded-lg border border-brand-forest/30 px-4 py-2 font-medium text-brand-forest hover:bg-brand-cream"
        >
          Quay lại
        </button>
        {canEdit && (
          <div className="flex gap-2">
            {booking && booking.status !== "hủy" && (
              <button
                type="button"
                onClick={handleCancelBooking}
                disabled={loading}
                className="rounded-lg border border-red-300 px-4 py-2 font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
              >
                Hủy đặt chỗ
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-brand-amber px-4 py-2 font-medium text-white hover:bg-brand-amber/90 disabled:opacity-60"
            >
              Tiếp tục
            </button>
          </div>
        )}
      </div>
    </form>
  );
}
