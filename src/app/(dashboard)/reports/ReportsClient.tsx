"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getRevenueSummary, type RevenueSummary } from "@/lib/actions/reports";
import { exportMultiSheetExcel } from "@/lib/export-excel";

function formatMoney(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}

function formatDay(d: string) {
  const date = new Date(`${d}T00:00:00`);
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

export default function ReportsClient({
  initialSummary,
  initialDateFrom,
  initialDateTo,
}: {
  initialSummary: RevenueSummary;
  initialDateFrom: string;
  initialDateTo: string;
}) {
  const [dateFrom, setDateFrom] = useState(initialDateFrom);
  const [dateTo, setDateTo] = useState(initialDateTo);
  const [summary, setSummary] = useState(initialSummary);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    setLoading(true);
    const data = await getRevenueSummary({
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    });
    setSummary(data);
    setLoading(false);
  }, [dateFrom, dateTo]);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    refetch();
  }, [refetch]);

  const maxDayRevenue = Math.max(1, ...summary.byDay.map((d) => d.revenue));

  function handleExport() {
    exportMultiSheetExcel(`bao-cao-doanh-thu_${dateFrom}_${dateTo}`, [
      {
        name: "Tổng quan",
        rows: [
          {
            "Từ ngày": dateFrom,
            "Đến ngày": dateTo,
            "Tổng doanh thu": summary.totalRevenue,
            "Tổng tiền cọc": summary.totalDeposit,
            "Số lượt đặt": summary.bookingCount,
            "Số lượt hủy": summary.cancelledCount,
            "Tiền khách bỏ cọc": summary.totalForfeitedDeposit,
            "Tổng phụ thu thêm giờ": summary.totalOverageFee,
            "Tổng thu dưới mức tối thiểu": summary.totalShortfall,
            "Công nợ chưa thu": summary.totalOutstanding,
            "Tổng doanh thu phụ": summary.totalExtraRevenue,
          },
        ],
      },
      {
        name: "Theo vị trí",
        rows: summary.byLocation.map((l) => ({
          "Vị trí": l.location_name,
          "Lượt đặt": l.count,
          "Doanh thu": l.revenue,
        })),
      },
      {
        name: "Theo ngày",
        rows: summary.byDay.map((d) => ({
          Ngày: d.date,
          "Doanh thu": d.revenue,
        })),
      },
    ]);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-brand-forest/15 bg-white p-4">
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
        {loading && <span className="text-xs text-brand-forest/50">Đang tải...</span>}
        <button
          type="button"
          onClick={handleExport}
          className="ml-auto rounded-lg border border-brand-forest/30 px-3 py-1.5 text-sm font-semibold text-brand-forest hover:bg-brand-cream"
        >
          Xuất file
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard label="Tổng doanh thu" value={formatMoney(summary.totalRevenue)} highlight />
        <SummaryCard label="Tổng tiền cọc" value={formatMoney(summary.totalDeposit)} />
        <SummaryCard label="Số lượt đặt" value={String(summary.bookingCount)} />
        <SummaryCard label="Số lượt hủy" value={String(summary.cancelledCount)} />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <SummaryCard label="Tiền khách bỏ cọc" value={formatMoney(summary.totalForfeitedDeposit)} />
        <SummaryCard label="Tổng phụ thu thêm giờ" value={formatMoney(summary.totalOverageFee)} />
        <SummaryCard
          label="Tổng thu dưới mức tối thiểu"
          value={formatMoney(summary.totalShortfall)}
        />
        <SummaryCard
          label="Công nợ (chưa thu)"
          value={formatMoney(summary.totalOutstanding)}
          tone="red"
        />
        <SummaryCard
          label="Tổng doanh thu phụ"
          value={formatMoney(summary.totalExtraRevenue)}
          highlight
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-brand-forest/15 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-brand-forest">
            Doanh thu theo vị trí
          </h2>
          <table className="w-full text-left text-sm">
            <thead className="text-brand-forest/60">
              <tr>
                <th className="whitespace-nowrap pb-2 font-medium">Vị trí</th>
                <th className="whitespace-nowrap pb-2 font-medium">Lượt đặt</th>
                <th className="whitespace-nowrap pb-2 font-medium">Doanh thu</th>
              </tr>
            </thead>
            <tbody>
              {summary.byLocation.map((l) => (
                <tr key={l.location_id} className="border-t border-brand-forest/10">
                  <td className="py-2 font-medium text-brand-forest">{l.location_name}</td>
                  <td className="py-2 text-brand-forest/70">{l.count}</td>
                  <td className="py-2 text-brand-forest/70">{formatMoney(l.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {summary.byLocation.length === 0 && (
            <p className="py-4 text-center text-sm text-brand-forest/50">
              Không có dữ liệu trong khoảng thời gian này.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-brand-forest/15 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-brand-forest">
            Doanh thu theo ngày
          </h2>
          <div className="flex flex-col gap-2">
            {summary.byDay.map((d) => (
              <div key={d.date} className="flex items-center gap-2 text-xs">
                <span className="w-10 shrink-0 text-brand-forest/60">{formatDay(d.date)}</span>
                <div className="h-4 flex-1 overflow-hidden rounded bg-brand-cream">
                  <div
                    className="h-full rounded bg-brand-amber"
                    style={{ width: `${(d.revenue / maxDayRevenue) * 100}%` }}
                  />
                </div>
                <span className="w-24 shrink-0 text-right text-brand-forest/70">
                  {formatMoney(d.revenue)}
                </span>
              </div>
            ))}
          </div>
          {summary.byDay.length === 0 && (
            <p className="py-4 text-center text-sm text-brand-forest/50">
              Không có dữ liệu trong khoảng thời gian này.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  highlight,
  tone = "forest",
}: {
  label: string;
  value: string;
  highlight?: boolean;
  tone?: "forest" | "red";
}) {
  const toneClass = highlight
    ? "text-brand-amber"
    : tone === "red"
    ? "text-red-600"
    : "text-brand-forest";

  return (
    <div className="rounded-xl border border-brand-forest/15 bg-white p-4">
      <p className="text-xs font-medium text-brand-forest/60">{label}</p>
      <p className={`mt-1 text-xl font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}
