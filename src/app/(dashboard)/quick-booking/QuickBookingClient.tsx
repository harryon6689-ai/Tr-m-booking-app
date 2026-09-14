"use client";

import { useState } from "react";
import type {
  BookingStatus,
  CustomerOrgType,
  CustomerType,
  Database,
} from "@/lib/types/database";
import { EQUIPMENT_OPTIONS } from "@/lib/types/database";
import { createBooking, type BookingInput } from "@/lib/actions/bookings";
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
import { defaultEffectiveUntil, formatDayMonth } from "@/lib/fixed-customers-utils";
import {
  type EntryType,
  ENTRY_TYPE_OPTIONS,
  entryTypeLabel,
  entryTypeToRecurrenceType,
  recurrenceLabel,
} from "@/lib/recurrence-entry-type";

type Location = Database["public"]["Tables"]["locations"]["Row"];
type DiscountRule = Database["public"]["Tables"]["discount_rules"]["Row"];
type PricingRule = Database["public"]["Tables"]["pricing_rules"]["Row"];
type PreferredCustomer = Database["public"]["Tables"]["preferred_customers"]["Row"];

type Step = "form" | "review" | "success";

function formatDateVn(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}/${d.getFullYear()}`;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default function QuickBookingClient({
  locations,
  discountRules,
  pricingRules,
  preferredCustomers,
  isAdmin,
  canEdit,
}: {
  locations: Location[];
  discountRules: DiscountRule[];
  pricingRules: PricingRule[];
  preferredCustomers: PreferredCustomer[];
  isAdmin: boolean;
  canEdit: boolean;
}) {
  const [step, setStep] = useState<Step>("form");
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [entryType, setEntryType] = useState<EntryType>("single");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [orgType, setOrgType] = useState<CustomerOrgType>("cá nhân");
  const [organizationName, setOrganizationName] = useState("");
  const [attendeeCount, setAttendeeCount] = useState("");
  const [startDate, setStartDate] = useState(todayStr());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("11:00");
  const [weekdays, setWeekdays] = useState<number[]>([new Date().getDay()]);
  const [monthDays, setMonthDays] = useState<number[]>([new Date().getDate()]);
  const [yearDates, setYearDates] = useState<string[]>([todayStr()]);
  const [effectiveUntil, setEffectiveUntil] = useState("");
  const [customerType, setCustomerType] = useState<CustomerType>("thường");
  const [discountApplied, setDiscountApplied] = useState(0);
  const [depositAmount, setDepositAmount] = useState(0);
  const [pricingRuleId, setPricingRuleId] = useState<string | null>(null);
  const [equipmentNeeded, setEquipmentNeeded] = useState<string[]>([]);
  const [equipmentNote, setEquipmentNote] = useState("");
  const [status, setStatus] = useState<BookingStatus>("đã đặt");
  const [vatInvoiceRequested, setVatInvoiceRequested] = useState(false);
  const [vatCompanyName, setVatCompanyName] = useState("");
  const [vatCompanyAddress, setVatCompanyAddress] = useState("");
  const [vatTaxCode, setVatTaxCode] = useState("");
  const [vatEmail, setVatEmail] = useState("");
  const [note, setNote] = useState("");
  const [seatNumber, setSeatNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [appliedPreferredId, setAppliedPreferredId] = useState<string | null>(null);
  const [dismissedPreferredId, setDismissedPreferredId] = useState<string | null>(null);

  const visibleEntryTypes = ENTRY_TYPE_OPTIONS.filter((o) => !o.adminOnly || isAdmin);
  const location = locations.find((l) => l.id === locationId) ?? null;
  const locationName = location?.name ?? "";

  const durationHours =
    entryType === "single" && startTime && endTime
      ? Math.max(
          0,
          (new Date(`${startDate}T${endTime}:00`).getTime() -
            new Date(`${startDate}T${startTime}:00`).getTime()) /
            3_600_000
        )
      : 0;
  const overageHours = location ? Math.max(0, durationHours - location.included_hours) : 0;
  const overageFee =
    location && overageHours > 0 ? overageHours * (location.overage_fee_per_hour ?? 0) : 0;

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

  const suggestedRules =
    entryType === "single" && location
      ? matchingPricingRules(
          pricingRules,
          location.type,
          attendeeCount ? Number(attendeeCount) : null
        )
      : [];

  function applyPricingRule(rule: PricingRule) {
    setPricingRuleId(rule.id);
  }

  function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!customerName.trim()) {
      setError("Nhập tên khách.");
      return;
    }
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length !== 10) {
      setError("Số điện thoại phải đủ 10 số.");
      return;
    }
    if (endTime <= startTime) {
      setError("Giờ kết thúc phải sau giờ bắt đầu.");
      return;
    }
    if (entryType === "weekly" && weekdays.length === 0) {
      setError("Chọn ít nhất 1 thứ trong tuần.");
      return;
    }
    if ((entryType === "monthly" || entryType === "quarterly") && monthDays.length === 0) {
      setError("Chọn ít nhất 1 ngày trong tháng.");
      return;
    }
    if (entryType === "yearly" && yearDates.length === 0) {
      setError("Thêm ít nhất 1 ngày lặp lại mỗi năm.");
      return;
    }
    if (
      entryType === "single" &&
      vatInvoiceRequested &&
      (!vatCompanyName.trim() || !vatCompanyAddress.trim() || !vatTaxCode.trim() || !vatEmail.trim())
    ) {
      setError("Nhập đủ thông tin xuất hoá đơn VAT (tên công ty, địa chỉ, mã số thuế, email).");
      return;
    }

    setStep("review");
  }

  async function handleConfirm() {
    setError(null);
    setLoading(true);

    if (entryType === "single") {
      const input: BookingInput = {
        location_id: locationId,
        customer_name: customerName,
        phone,
        start_time: new Date(`${startDate}T${startTime}:00`).toISOString(),
        end_time: new Date(`${startDate}T${endTime}:00`).toISOString(),
        status,
        deposit_amount: depositAmount,
        discount_applied: discountApplied,
        final_price: 0,
        overage_fee: overageFee,
        overage_fee_paid: false,
        minimum_spend_shortfall_paid: false,
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
        actual_drink_spend: 0,
        seat_number: location?.type === "ghế ngoài" ? seatNumber || null : null,
      };
      const result = await createBooking(input);
      setLoading(false);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccessMessage(
        `Đã đặt chỗ cho "${customerName}" tại ${locationName}, ngày ${formatDateVn(startDate)} (${startTime} - ${endTime}).`
      );
    } else {
      const recurrenceType = entryTypeToRecurrenceType(entryType)!;

      const input: FixedCustomerInput = {
        location_id: locationId,
        customer_name: customerName,
        phone,
        recurrence_type: recurrenceType,
        weekday: recurrenceType === "hàng tuần" ? weekdays : null,
        day_of_month:
          recurrenceType === "hàng tháng" || recurrenceType === "hàng quý"
            ? monthDays
            : null,
        custom_dates: recurrenceType === "hàng năm" ? yearDates : null,
        start_time: startTime,
        end_time: endTime,
        effective_from: startDate,
        effective_until: effectiveUntil || null,
        active: true,
        deposit_amount: 0,
        note,
        seat_number: location?.type === "ghế ngoài" ? seatNumber || null : null,
      };
      const result = await createFixedCustomer(input);
      setLoading(false);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccessMessage(
        `Đã tạo lịch định kỳ cho "${customerName}" tại ${locationName} — ${recurrenceLabel(
          entryType,
          startDate,
          weekdays,
          monthDays,
          yearDates
        )}.`
      );
    }

    setStep("success");
  }

  function handleBookAnother() {
    setCustomerName("");
    setPhone("");
    setOrgType("cá nhân");
    setOrganizationName("");
    setAttendeeCount("");
    setCustomerType("thường");
    setDiscountApplied(0);
    setDepositAmount(0);
    setPricingRuleId(null);
    setEquipmentNeeded([]);
    setEquipmentNote("");
    setStatus("đã đặt");
    setVatInvoiceRequested(false);
    setVatCompanyName("");
    setVatCompanyAddress("");
    setVatTaxCode("");
    setVatEmail("");
    setAppliedPreferredId(null);
    setDismissedPreferredId(null);
    setNote("");
    setSeatNumber("");
    setError(null);
    setSuccessMessage(null);
    setStep("form");
  }

  if (step === "success") {
    return (
      <div className="flex max-w-2xl flex-col items-center gap-4 rounded-xl border border-brand-forest/15 bg-white p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-forest/10 text-3xl text-brand-forest">
          ✓
        </div>
        <div>
          <p className="text-lg font-bold text-brand-forest">Đặt lịch thành công!</p>
          <p className="mt-1 text-sm text-brand-forest/70">{successMessage}</p>
        </div>
        <button
          onClick={handleBookAnother}
          className="rounded-lg bg-brand-amber px-5 py-2 font-bold text-white hover:bg-brand-amber/90"
        >
          Tiếp tục đặt lịch cho khách mới
        </button>
      </div>
    );
  }

  if (step === "review") {
    return (
      <div className="flex max-w-2xl flex-col gap-4 rounded-xl border border-brand-forest/15 bg-white p-6">
        <p className="text-sm font-medium text-brand-forest/70">
          Kiểm tra lại thông tin trước khi xác nhận
        </p>

        <div className="rounded-lg border border-brand-forest/15 px-4">
          <ReviewRow label="Kiểu đặt" value={entryTypeLabel(entryType)} />
          <ReviewRow label="Vị trí" value={locationName} />
          <ReviewRow label="Tên khách" value={customerName} />
          <ReviewRow label="Số điện thoại" value={phone || "-"} />
          {location?.type === "ghế ngoài" && (
            <ReviewRow label="Số vị trí" value={seatNumber || "-"} />
          )}
          {entryType === "single" && (
            <>
              <ReviewRow
                label="Khách hàng là"
                value={orgType === "công ty/tổ chức" ? "Công ty/Tổ chức" : "Cá nhân"}
              />
              {orgType === "công ty/tổ chức" && (
                <ReviewRow label="Tên công ty/tổ chức" value={organizationName || "-"} />
              )}
              <ReviewRow label="Số người tham gia" value={attendeeCount || "-"} />
            </>
          )}
          {entryType === "single" ? (
            <ReviewRow label="Ngày đặt" value={formatDateVn(startDate)} />
          ) : (
            <>
              <ReviewRow label="Bắt đầu từ ngày" value={formatDateVn(startDate)} />
              <ReviewRow label="Lặp lại" value={recurrenceLabel(entryType, startDate, weekdays, monthDays, yearDates)} />
              <ReviewRow
                label="Hiệu lực đến"
                value={effectiveUntil ? formatDateVn(effectiveUntil) : "Vô thời hạn"}
              />
            </>
          )}
          <ReviewRow label="Giờ" value={`${startTime} - ${endTime}`} />
          {entryType === "single" && (
            <>
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
              <ReviewRow
                label="Trạng thái"
                value={
                  status === "đã tới" ? "Đã tới" : status === "hủy" ? "Hủy" : "Đã đặt"
                }
              />
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
            {loading ? "Đang lưu..." : "Xác nhận đặt lịch"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleContinue}
      className="flex max-w-2xl flex-col gap-4 rounded-xl border border-brand-forest/15 bg-white p-6"
    >
      <div>
        <label className="mb-1.5 block text-sm font-medium text-brand-forest">
          Kiểu đặt
        </label>
        <div className="flex flex-wrap gap-1.5">
          {visibleEntryTypes.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                setEntryType(o.value);
                const recurrenceType = entryTypeToRecurrenceType(o.value);
                setEffectiveUntil(
                  recurrenceType ? defaultEffectiveUntil(recurrenceType, startDate) ?? "" : ""
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
        {!isAdmin && (
          <p className="mt-1.5 text-xs text-brand-forest/50">
            Chỉ Quản lý (Admin) mới tạo được lịch đặt định kỳ.
          </p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-brand-forest">
          Vị trí (phòng/box/chỗ ngồi)
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
            Số điện thoại (đủ 10 số)
          </label>
          <input
            required
            inputMode="numeric"
            maxLength={10}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="09xxxxxxxx"
            className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
          />
        </div>
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-forest">
            {entryType === "single" ? "Ngày đặt" : "Bắt đầu từ ngày"}
          </label>
          <input
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
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

      {entryType !== "single" && (
        <>
          <p className="rounded-lg bg-brand-cream px-3 py-2 text-xs font-medium text-brand-forest">
            {recurrenceLabel(entryType, startDate, weekdays, monthDays, yearDates)}
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

      {entryType === "single" && suggestedRules.length > 0 && (
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-forest">
            Chính sách giá gợi ý
          </label>
          <div className="flex flex-col gap-2">
            {suggestedRules.map((rule) => {
              const startIso = new Date(`${startDate}T${startTime}:00`).toISOString();
              const endIso = new Date(`${startDate}T${endTime}:00`).toISOString();
              const preview = computeSuggestedPrice(rule, startIso, endIso);
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
        <>
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

          {overageHours > 0 && (
            <p className="rounded-lg bg-brand-cream px-3 py-2 text-xs font-medium text-brand-forest">
              Thời lượng đặt chỗ vượt{" "}
              <span className="font-bold">{location?.included_hours}h</span> quy định{" "}
              {overageHours.toFixed(1)}h — phụ thu thêm giờ tự tính:{" "}
              <span className="font-bold">{overageFee.toLocaleString("vi-VN")}đ</span>.
            </p>
          )}

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
        </>
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

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={!canEdit}
        className="w-fit rounded-lg bg-brand-amber px-5 py-2 font-bold text-white hover:bg-brand-amber/90 disabled:opacity-60"
      >
        Tiếp tục
      </button>
      {!canEdit && (
        <p className="text-xs text-brand-forest/50">
          Tài khoản chỉ xem, không thể tạo đặt chỗ.
        </p>
      )}
    </form>
  );
}
