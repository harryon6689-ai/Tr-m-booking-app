"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Database, BookingStatus } from "@/lib/types/database";
import {
  searchBookingHistory,
  type HistoryRow,
  type RepeatCustomer,
  type CustomerCategory,
} from "@/lib/actions/booking-history";
import CustomerHistoryModal, {
  type CustomerIdentity,
} from "./CustomerHistoryModal";
import ExportExcelButton from "@/components/ExportExcelButton";

type Location = Database["public"]["Tables"]["locations"]["Row"];

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

export default function HistoryClient({
  locations,
  initialRows,
  initialRepeatCustomers,
}: {
  locations: Location[];
  initialRows: HistoryRow[];
  initialRepeatCustomers: RepeatCustomer[];
}) {
  const [tab, setTab] = useState<"history" | "repeat">("history");

  const [locationId, setLocationId] = useState("");
  const [status, setStatus] = useState<BookingStatus | "">("");
  const [customerCategory, setCustomerCategory] = useState<CustomerCategory | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [rawQuery, setRawQuery] = useState("");
  const [query, setQuery] = useState("");

  const [rows, setRows] = useState<HistoryRow[]>(initialRows);
  const [loading, setLoading] = useState(false);

  const [repeatCustomers] = useState<RepeatCustomer[]>(initialRepeatCustomers);
  const [repeatLoading] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState<CustomerIdentity | null>(
    null
  );

  useEffect(() => {
    const timer = setTimeout(() => setQuery(rawQuery), 350);
    return () => clearTimeout(timer);
  }, [rawQuery]);

  const refetch = useCallback(async () => {
    const data = await searchBookingHistory({
      locationId: locationId || undefined,
      status: status || undefined,
      customerCategory: customerCategory || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      query: query || undefined,
    });
    setRows(data);
    setLoading(false);
  }, [locationId, status, customerCategory, dateFrom, dateTo, query]);

  const isFirstHistoryRender = useRef(true);
  useEffect(() => {
    if (isFirstHistoryRender.current) {
      isFirstHistoryRender.current = false;
      return;
    }
    refetch();
  }, [refetch]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-fit rounded-lg border border-brand-forest/20 p-0.5">
        <button
          onClick={() => setTab("history")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
            tab === "history" ? "bg-brand-forest text-brand-cream" : "text-brand-forest"
          }`}
        >
          Lịch sử
        </button>
        <button
          onClick={() => setTab("repeat")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
            tab === "repeat" ? "bg-brand-forest text-brand-cream" : "text-brand-forest"
          }`}
        >
          Khách đặt lại
        </button>
      </div>

      {tab === "history" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-3 rounded-xl border border-brand-forest/15 bg-white p-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-brand-forest/70">
                Tìm khách/SĐT/Công ty
              </label>
              <input
                value={rawQuery}
                onChange={(e) => setRawQuery(e.target.value)}
                placeholder="Tên, SĐT hoặc tên công ty/tổ chức"
                className="rounded-lg border border-brand-forest/30 px-3 py-1.5 text-sm outline-none focus:border-brand-amber"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-brand-forest/70">
                Loại khách
              </label>
              <select
                value={customerCategory}
                onChange={(e) => setCustomerCategory(e.target.value as CustomerCategory | "")}
                className="rounded-lg border border-brand-forest/30 px-3 py-1.5 text-sm outline-none focus:border-brand-amber"
              >
                <option value="">Tất cả</option>
                <option value="cá nhân">Cá nhân</option>
                <option value="công ty/tổ chức">Công ty/Tổ chức</option>
                <option value="khách cố định">Khách cố định</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-brand-forest/70">Vị trí</label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="rounded-lg border border-brand-forest/30 px-3 py-1.5 text-sm outline-none focus:border-brand-amber"
              >
                <option value="">Tất cả</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-brand-forest/70">
                Trạng thái
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as BookingStatus | "")}
                className="rounded-lg border border-brand-forest/30 px-3 py-1.5 text-sm outline-none focus:border-brand-amber"
              >
                <option value="">Tất cả</option>
                <option value="đã đặt">Đã đặt</option>
                <option value="đã tới">Đã tới</option>
                <option value="hủy">Đã hủy</option>
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
          </div>

          <div className="flex justify-end">
            <ExportExcelButton
              filename="lich-su-dat-cho"
              sheetName="Lịch sử"
              rows={rows.map((r) => ({
                "Ngày giờ": formatDateTime(r.start_time),
                "Vị trí": r.location_name,
                "Khách hàng": r.customer_name,
                "Đối tượng": r.org_type === "công ty/tổ chức" ? "Công ty/Tổ chức" : "Cá nhân",
                "Công ty/Tổ chức": r.organization_name ?? "",
                SĐT: r.phone ?? "",
                "Trạng thái": STATUS_LABEL[r.status],
                "Giá cuối": r.final_price,
              }))}
            />
          </div>

          <div className="overflow-x-auto rounded-xl border border-brand-forest/15 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-brand-cream text-brand-forest/70">
                <tr>
                  <th className="whitespace-nowrap px-3 py-2 font-semibold">Ngày giờ</th>
                  <th className="whitespace-nowrap px-3 py-2 font-semibold">Vị trí</th>
                  <th className="whitespace-nowrap px-3 py-2 font-semibold">Khách hàng</th>
                  <th className="whitespace-nowrap px-3 py-2 font-semibold">Đối tượng</th>
                  <th className="whitespace-nowrap px-3 py-2 font-semibold">Công ty/Tổ chức</th>
                  <th className="whitespace-nowrap px-3 py-2 font-semibold">SĐT</th>
                  <th className="whitespace-nowrap px-3 py-2 font-semibold">Trạng thái</th>
                  <th className="whitespace-nowrap px-3 py-2 font-semibold">Giá cuối</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-brand-forest/10">
                    <td className="px-3 py-2 text-brand-forest/80">
                      {formatDateTime(r.start_time)}
                    </td>
                    <td className="px-3 py-2 text-brand-forest/80">{r.location_name}</td>
                    <td className="px-3 py-2 font-medium">
                      <button
                        onClick={() =>
                          setSelectedCustomer({ name: r.customer_name, phone: r.phone ?? "" })
                        }
                        className="text-brand-forest hover:underline"
                      >
                        {r.customer_name}
                      </button>
                    </td>
                    <td className="px-3 py-2">
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
                    <td className="px-3 py-2 text-brand-forest/80">
                      {r.organization_name || "-"}
                    </td>
                    <td className="px-3 py-2">
                      {r.phone ? (
                        <button
                          onClick={() =>
                            setSelectedCustomer({ name: r.customer_name, phone: r.phone ?? "" })
                          }
                          className="text-brand-forest/80 hover:underline"
                        >
                          {r.phone}
                        </button>
                      ) : (
                        "-"
                      )}
                    </td>
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
                Không có kết quả phù hợp.
              </p>
            )}
            {loading && (
              <p className="p-4 text-center text-sm text-brand-forest/50">Đang tải...</p>
            )}
          </div>
        </div>
      )}

      {tab === "repeat" && (
        <div className="flex flex-col gap-3">
          <div className="flex justify-end">
            <ExportExcelButton
              filename="khach-dat-lai"
              sheetName="Khách đặt lại"
              rows={repeatCustomers.map((c) => ({
                "Khách hàng": c.name,
                SĐT: c.phone,
                "Số lần đặt": c.visitCount,
                "Lần gần nhất": formatDateTime(c.lastVisit),
              }))}
            />
          </div>
          <div className="overflow-x-auto rounded-xl border border-brand-forest/15 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-brand-cream text-brand-forest/70">
              <tr>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">Khách hàng</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">SĐT</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">Số lần đặt</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">Lần gần nhất</th>
              </tr>
            </thead>
            <tbody>
              {repeatCustomers.map((c) => (
                <tr key={c.key} className="border-t border-brand-forest/10">
                  <td className="px-3 py-2 font-medium">
                    <button
                      onClick={() => setSelectedCustomer({ name: c.name, phone: c.phone })}
                      className="text-brand-forest hover:underline"
                    >
                      {c.name}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    {c.phone ? (
                      <button
                        onClick={() => setSelectedCustomer({ name: c.name, phone: c.phone })}
                        className="text-brand-forest/80 hover:underline"
                      >
                        {c.phone}
                      </button>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-brand-amber/20 px-2 py-0.5 text-xs font-bold text-brand-amber">
                      {c.visitCount} lần
                    </span>
                  </td>
                  <td className="px-3 py-2 text-brand-forest/80">
                    {formatDateTime(c.lastVisit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!repeatLoading && repeatCustomers.length === 0 && (
            <p className="p-4 text-center text-sm text-brand-forest/50">
              Chưa có khách nào đặt từ 2 lần trở lên.
            </p>
          )}
          {repeatLoading && (
            <p className="p-4 text-center text-sm text-brand-forest/50">Đang tải...</p>
          )}
          </div>
        </div>
      )}

      {selectedCustomer && (
        <CustomerHistoryModal
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
        />
      )}
    </div>
  );
}
