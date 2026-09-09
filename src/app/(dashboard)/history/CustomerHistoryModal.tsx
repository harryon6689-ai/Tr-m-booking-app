"use client";

import { useCallback, useEffect, useState } from "react";
import type { BookingStatus } from "@/lib/types/database";
import {
  getCustomerBookingHistory,
  type HistoryRow,
} from "@/lib/actions/booking-history";

const STATUS_LABEL: Record<BookingStatus, string> = {
  "đã đặt": "Đã đặt",
  "đã tới": "Đã tới",
  hủy: "Đã hủy",
};

function formatMoney(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export interface CustomerIdentity {
  name: string;
  phone: string;
}

export default function CustomerHistoryModal({
  customer,
  onClose,
}: {
  customer: CustomerIdentity;
  onClose: () => void;
}) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const data = await getCustomerBookingHistory({
      phone: customer.phone || undefined,
      name: customer.phone ? undefined : customer.name,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    });
    setRows(data);
    setLoading(false);
  }, [customer.phone, customer.name, dateFrom, dateTo]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional data fetch on filter change
    refetch();
  }, [refetch]);

  const totalSpent = rows
    .filter((r) => r.status !== "hủy")
    .reduce((sum, r) => sum + r.final_price, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-brand-forest">{customer.name}</h2>
            {customer.phone && (
              <p className="text-sm text-brand-forest/60">{customer.phone}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-brand-forest/60 hover:bg-brand-cream"
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-end gap-3">
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
          <p className="ml-auto text-sm text-brand-forest/70">
            {rows.length} lượt đặt · Tổng chi tiêu{" "}
            <span className="font-bold text-brand-amber">{formatMoney(totalSpent)}</span>
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-brand-forest/15">
          <table className="w-full text-left text-sm">
            <thead className="bg-brand-cream text-brand-forest/70">
              <tr>
                <th className="px-3 py-2 font-semibold">Ngày giờ</th>
                <th className="px-3 py-2 font-semibold">Vị trí</th>
                <th className="px-3 py-2 font-semibold">Trạng thái</th>
                <th className="px-3 py-2 font-semibold">Giá cuối</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-brand-forest/10">
                  <td className="px-3 py-2 text-brand-forest/80">
                    {formatDateTime(r.start_time)}
                  </td>
                  <td className="px-3 py-2 text-brand-forest/80">{r.location_name}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.status === "hủy"
                          ? "bg-gray-200 text-gray-600"
                          : "bg-brand-amber/20 text-brand-amber"
                      }`}
                    >
                      {STATUS_LABEL[r.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-brand-forest/80">
                    {formatMoney(r.final_price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && rows.length === 0 && (
            <p className="p-4 text-center text-sm text-brand-forest/50">
              Không có lịch sử đặt chỗ nào.
            </p>
          )}
          {loading && (
            <p className="p-4 text-center text-sm text-brand-forest/50">Đang tải...</p>
          )}
        </div>
      </div>
    </div>
  );
}
