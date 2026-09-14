"use client";

import type { CheckinRow } from "@/lib/actions/booking-history";
import ReviewRow from "@/components/ReviewRow";

const RECURRENCE_LABEL: Record<string, string> = {
  "hàng tuần": "Hàng tuần",
  "hàng tháng": "Hàng tháng",
  "hàng quý": "Hàng quý",
  "hàng năm": "Hàng năm",
  "ngày cụ thể": "Ngày cụ thể",
};

const STATUS_LABEL: Record<string, string> = {
  "đã đặt": "Chưa đến",
  "đã tới": "Đã đến",
  hủy: "Đã hủy",
};

function formatMoney(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}

function formatTimeRange(startIso: string, endIso: string) {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  return `${fmt(startIso)} - ${fmt(endIso)}`;
}

export default function CheckInQuickView({
  row,
  minimumSpend,
  onClose,
}: {
  row: CheckinRow;
  minimumSpend: number | null;
  onClose: () => void;
}) {
  const hasMinimumSpend = !row.is_fixed_customer && minimumSpend != null && minimumSpend > 0;
  const actualSpend = row.actual_drink_spend ?? 0;
  const shortfall = hasMinimumSpend ? Math.max(0, minimumSpend! - actualSpend) : 0;
  const overageFee = row.is_fixed_customer ? 0 : row.overage_fee;
  const totalExtraDue = shortfall + overageFee;
  const hasAnyExtraPolicy = hasMinimumSpend || overageFee > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-brand-forest">{row.customer_name}</h2>
            {row.is_fixed_customer && row.recurrence_type && (
              <p className="text-xs text-brand-forest/60">
                Khách cố định · {RECURRENCE_LABEL[row.recurrence_type] ?? row.recurrence_type}
              </p>
            )}
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
          <ReviewRow label="Vị trí" value={row.location_name} />
          <ReviewRow label="Giờ" value={formatTimeRange(row.start_time, row.end_time)} />
          <ReviewRow label="Số điện thoại" value={row.phone || "-"} />
          <ReviewRow
            label="Đối tượng"
            value={row.org_type === "công ty/tổ chức" ? "Công ty/Tổ chức" : "Cá nhân"}
          />
          {row.organization_name && (
            <ReviewRow label="Tên công ty/tổ chức" value={row.organization_name} />
          )}
          <ReviewRow label="Số người tham gia" value={String(row.attendee_count ?? "-")} />
          <ReviewRow label="Đặt cọc" value={formatMoney(row.deposit_amount)} />
          {row.deposit_amount > 0 && !row.is_fixed_customer && (
            <ReviewRow
              label="Hoàn cọc"
              value={
                row.status === "hủy"
                  ? "Bỏ cọc"
                  : row.deposit_refunded
                  ? "Đã hoàn"
                  : "Chưa hoàn"
              }
            />
          )}
          <ReviewRow label="Giảm giá" value={`${row.discount_applied}%`} />
          {row.equipment_needed.length > 0 && (
            <ReviewRow label="Thiết bị" value={row.equipment_needed.join(", ")} />
          )}
          {row.equipment_note && <ReviewRow label="Thiết bị khác" value={row.equipment_note} />}
          {row.vat_invoice_requested && (
            <>
              <ReviewRow label="Xuất hoá đơn VAT" value="Có" />
              <ReviewRow label="Tên công ty (VAT)" value={row.vat_company_name || "-"} />
              <ReviewRow label="Địa chỉ (VAT)" value={row.vat_company_address || "-"} />
              <ReviewRow label="Mã số thuế" value={row.vat_tax_code || "-"} />
              <ReviewRow label="Email (VAT)" value={row.vat_email || "-"} />
            </>
          )}
          {hasMinimumSpend && (
            <>
              <ReviewRow label="Mức chi tối thiểu quy định" value={formatMoney(minimumSpend!)} />
              <ReviewRow label="Tiền đồ uống thực tế" value={formatMoney(actualSpend)} />
              {shortfall > 0 && (
                <ReviewRow
                  label="Thanh toán thêm (dưới mức)"
                  value={row.minimum_spend_shortfall_paid ? "Đã thu" : "Chưa thu"}
                />
              )}
            </>
          )}
          {!row.is_fixed_customer && row.overage_fee > 0 && (
            <>
              <ReviewRow label="Phụ thu thêm giờ" value={formatMoney(row.overage_fee)} />
              <ReviewRow
                label="Thanh toán phụ thu"
                value={row.overage_fee_paid ? "Đã thu" : "Chưa thu"}
              />
            </>
          )}
          <ReviewRow
            label="Trạng thái"
            value={row.is_fixed_customer ? STATUS_LABEL[row.status] : STATUS_LABEL[row.status]}
          />
          <ReviewRow label="Ghi chú" value={row.note || "-"} />
        </div>

        {hasAnyExtraPolicy && (
          <p
            className={`mt-3 rounded-lg px-3 py-2 text-sm font-bold ${
              totalExtraDue > 0
                ? "bg-red-50 text-red-600"
                : "bg-brand-forest/10 text-brand-forest"
            }`}
          >
            {totalExtraDue > 0
              ? `Khách cần thanh toán thêm: ${formatMoney(totalExtraDue)}`
              : "Đã đủ mức chi tối thiểu, không cần thanh toán thêm."}
          </p>
        )}

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
