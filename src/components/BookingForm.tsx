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
import CurrencyInput from "@/components/CurrencyInput";
import {
  formatPricingRule,
  formatAttendeeRange,
  computeSuggestedPrice,
  matchingPricingRules,
} from "@/lib/pricing-rules-utils";

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
  onDone: () => void;
  onCancelForm: () => void;
}) {
  const defaults = defaultTimes(defaultDate ?? new Date(), defaultStartHour, defaultEndHour);

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
  const [finalPrice, setFinalPrice] = useState(booking?.final_price ?? 0);
  const [pricingRuleId, setPricingRuleId] = useState<string | null>(
    booking?.pricing_rule_id ?? null
  );
  const [equipmentNeeded, setEquipmentNeeded] = useState<string[]>(
    booking?.equipment_needed ?? []
  );
  const [equipmentNote, setEquipmentNote] = useState(booking?.equipment_note ?? "");
  const [status, setStatus] = useState<BookingStatus>(booking?.status ?? "đã đặt");
  const [note, setNote] = useState(booking?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
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

  function applyPricingRule(rule: PricingRule) {
    const suggested = computeSuggestedPrice(rule, startTime, endTime);
    setFinalPrice(suggested);
    setPricingRuleId(rule.id);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (new Date(endTime) <= new Date(startTime)) {
      setError("Giờ kết thúc phải sau giờ bắt đầu.");
      return;
    }

    setLoading(true);

    const input = {
      location_id: location.id,
      customer_name: customerName,
      phone,
      start_time: new Date(startTime).toISOString(),
      end_time: new Date(endTime).toISOString(),
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

    const result = booking
      ? await updateBooking(booking.id, input)
      : await createBooking(input);

    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    onDone();
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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {!canEdit && (
        <p className="rounded-lg bg-brand-forest/10 px-3 py-2 text-xs font-medium text-brand-forest/70">
          Tài khoản chỉ xem — bạn có thể xem chi tiết nhưng không thể tạo/sửa/hủy đặt chỗ.
        </p>
      )}
      <fieldset disabled={!canEdit} className="contents">
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

      {matchedPreferredCustomer &&
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

      {matchedPreferredCustomer && matchedPreferredCustomer.id === appliedPreferredId && (
        <p className="text-xs font-medium text-brand-forest/70">
          ✓ Đã áp dụng hồ sơ khách {matchedPreferredCustomer.customer_type}:{" "}
          {matchedPreferredCustomer.name}
        </p>
      )}

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
            Số điện thoại
          </label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
          />
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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

      {suggestedRules.length > 0 && (
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
              {loading ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        )}
      </div>
    </form>
  );
}
