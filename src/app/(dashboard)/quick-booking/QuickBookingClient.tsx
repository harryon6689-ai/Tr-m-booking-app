"use client";

import { useState } from "react";
import type {
  BookingStatus,
  CustomerOrgType,
  CustomerType,
  Database,
  RecurrenceType,
} from "@/lib/types/database";
import { EQUIPMENT_OPTIONS } from "@/lib/types/database";
import { createBooking, type BookingInput } from "@/lib/actions/bookings";
import {
  createFixedCustomer,
  type FixedCustomerInput,
} from "@/lib/actions/fixed-customers";
import CurrencyInput from "@/components/CurrencyInput";
import {
  formatPricingRule,
  formatAttendeeRange,
  computeSuggestedPrice,
  matchingPricingRules,
} from "@/lib/pricing-rules-utils";

type Location = Database["public"]["Tables"]["locations"]["Row"];
type DiscountRule = Database["public"]["Tables"]["discount_rules"]["Row"];
type PricingRule = Database["public"]["Tables"]["pricing_rules"]["Row"];
type PreferredCustomer = Database["public"]["Tables"]["preferred_customers"]["Row"];

type EntryType = "single" | "weekly" | "monthly" | "quarterly" | "yearly";
type Step = "form" | "review" | "success";

const WEEKDAY_LABELS = [
  "Chủ nhật",
  "Thứ 2",
  "Thứ 3",
  "Thứ 4",
  "Thứ 5",
  "Thứ 6",
  "Thứ 7",
];

const ENTRY_TYPE_OPTIONS: { value: EntryType; label: string; adminOnly: boolean }[] = [
  { value: "single", label: "Lẻ (theo ngày)", adminOnly: false },
  { value: "weekly", label: "Định kỳ - Tuần", adminOnly: true },
  { value: "monthly", label: "Định kỳ - Tháng", adminOnly: true },
  { value: "quarterly", label: "Định kỳ - Quý", adminOnly: true },
  { value: "yearly", label: "Định kỳ - Năm", adminOnly: true },
];

function entryTypeLabel(entryType: EntryType): string {
  return ENTRY_TYPE_OPTIONS.find((o) => o.value === entryType)?.label ?? "";
}

function recurrenceLabel(entryType: EntryType, startDate: string): string {
  const d = new Date(`${startDate}T00:00:00`);
  switch (entryType) {
    case "weekly":
      return `Lặp lại hàng tuần vào ${WEEKDAY_LABELS[d.getDay()]}`;
    case "monthly":
      return `Lặp lại hàng tháng vào ngày ${d.getDate()}`;
    case "quarterly":
      return `Lặp lại mỗi 3 tháng, vào ngày ${d.getDate()} (tính từ ngày bắt đầu)`;
    case "yearly":
      return `Lặp lại hàng năm vào ${d.getDate()}/${d.getMonth() + 1}`;
    default:
      return "";
  }
}

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

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-brand-forest/10 py-2 text-sm last:border-0">
      <span className="text-brand-forest/60">{label}</span>
      <span className="text-right font-medium text-brand-forest">{value}</span>
    </div>
  );
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
  const [effectiveUntil, setEffectiveUntil] = useState("");
  const [customerType, setCustomerType] = useState<CustomerType>("thường");
  const [discountApplied, setDiscountApplied] = useState(0);
  const [depositAmount, setDepositAmount] = useState(0);
  const [finalPrice, setFinalPrice] = useState(0);
  const [pricingRuleId, setPricingRuleId] = useState<string | null>(null);
  const [equipmentNeeded, setEquipmentNeeded] = useState<string[]>([]);
  const [equipmentNote, setEquipmentNote] = useState("");
  const [status, setStatus] = useState<BookingStatus>("đã đặt");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [appliedPreferredId, setAppliedPreferredId] = useState<string | null>(null);
  const [dismissedPreferredId, setDismissedPreferredId] = useState<string | null>(null);

  const visibleEntryTypes = ENTRY_TYPE_OPTIONS.filter((o) => !o.adminOnly || isAdmin);
  const location = locations.find((l) => l.id === locationId) ?? null;
  const locationName = location?.name ?? "";

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
    const startIso = new Date(`${startDate}T${startTime}:00`).toISOString();
    const endIso = new Date(`${startDate}T${endTime}:00`).toISOString();
    setFinalPrice(computeSuggestedPrice(rule, startIso, endIso));
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
        final_price: finalPrice,
        note,
        org_type: orgType,
        organization_name: orgType === "công ty/tổ chức" ? organizationName : null,
        attendee_count: attendeeCount ? Number(attendeeCount) : null,
        equipment_needed: equipmentNeeded,
        equipment_note: equipmentNote,
        pricing_rule_id: pricingRuleId,
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
      const d = new Date(`${startDate}T00:00:00`);
      const recurrenceType: RecurrenceType =
        entryType === "weekly"
          ? "hàng tuần"
          : entryType === "monthly"
          ? "hàng tháng"
          : entryType === "quarterly"
          ? "hàng quý"
          : "hàng năm";

      const input: FixedCustomerInput = {
        location_id: locationId,
        customer_name: customerName,
        phone,
        recurrence_type: recurrenceType,
        weekday: recurrenceType === "hàng tuần" ? d.getDay() : null,
        day_of_month: recurrenceType === "hàng tuần" ? null : d.getDate(),
        month_of_year: recurrenceType === "hàng năm" ? d.getMonth() + 1 : null,
        custom_dates: null,
        start_time: startTime,
        end_time: endTime,
        effective_from: startDate,
        effective_until: effectiveUntil || null,
        active: true,
        deposit_amount: 0,
        note,
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
          startDate
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
    setFinalPrice(0);
    setPricingRuleId(null);
    setEquipmentNeeded([]);
    setEquipmentNote("");
    setStatus("đã đặt");
    setAppliedPreferredId(null);
    setDismissedPreferredId(null);
    setNote("");
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
              <ReviewRow label="Lặp lại" value={recurrenceLabel(entryType, startDate)} />
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
              <ReviewRow label="Giá cuối" value={`${finalPrice.toLocaleString("vi-VN")}đ`} />
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
              onClick={() => setEntryType(o.value)}
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
        <div className="grid grid-cols-2 gap-3">
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

      {entryType !== "single" && (
        <>
          <p className="rounded-lg bg-brand-cream px-3 py-2 text-xs font-medium text-brand-forest">
            {recurrenceLabel(entryType, startDate)}
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-brand-forest">
                Giảm giá (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={discountApplied}
                onChange={(e) => setDiscountApplied(Number(e.target.value))}
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
            <div>
              <label className="mb-1 block text-sm font-medium text-brand-forest">
                Giá cuối
              </label>
              <CurrencyInput
                value={finalPrice}
                onChange={setFinalPrice}
                className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
              />
            </div>
          </div>

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
