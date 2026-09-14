"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { BookingStatus, Database } from "@/lib/types/database";
import { createClient } from "@/lib/supabase/client";
import { getBookingsForLocationYear } from "@/lib/actions/booking-queries";
import { getFixedCustomersForLocation } from "@/lib/actions/fixed-customers";
import MonthCalendar, { ymd } from "@/components/calendar/MonthCalendar";
import YearCalendar from "@/components/calendar/YearCalendar";
import BookingForm from "@/components/BookingForm";
import { PERIODS, type Period } from "@/lib/periods";
import { expandFixedCustomerDates, overlapsFixedTime } from "@/lib/fixed-customers-utils";

type Booking = Database["public"]["Tables"]["bookings"]["Row"];
type Location = Database["public"]["Tables"]["locations"]["Row"];
type DiscountRule = Database["public"]["Tables"]["discount_rules"]["Row"];
type PricingRule = Database["public"]["Tables"]["pricing_rules"]["Row"];
type FixedCustomer = Database["public"]["Tables"]["fixed_customers"]["Row"];
type PreferredCustomer = Database["public"]["Tables"]["preferred_customers"]["Row"];

const STATUS_LABEL: Record<BookingStatus, string> = {
  "đã đặt": "Đã đặt",
  "đã tới": "Đã tới",
  hủy: "Đã hủy",
};

const MONTH_LABELS = [
  "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
  "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12",
];

interface CalendarBookingModalProps {
  location: Location;
  discountRules: DiscountRule[];
  pricingRules: PricingRule[];
  preferredCustomers: PreferredCustomer[];
  canEdit: boolean;
  onClose: () => void;
}

export default function CalendarBookingModal({
  location,
  discountRules,
  pricingRules,
  preferredCustomers,
  canEdit,
  onClose,
}: CalendarBookingModalProps) {
  const now = new Date();
  const [view, setView] = useState<"month" | "year">("month");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [yearBookings, setYearBookings] = useState<Booking[]>([]);
  const [fixedCustomers, setFixedCustomers] = useState<FixedCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dayMode, setDayMode] = useState<"list" | "form">("list");
  const [editing, setEditing] = useState<Booking | null>(null);
  const [periodDefault, setPeriodDefault] = useState<Period | null>(null);

  const refetchYear = useCallback(async () => {
    const [bookings, fixed] = await Promise.all([
      getBookingsForLocationYear(location.id, year),
      getFixedCustomersForLocation(location.id),
    ]);
    setYearBookings(bookings);
    setFixedCustomers(fixed);
    setLoading(false);
  }, [location.id, year]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional data fetch on location/year change
    refetchYear();
  }, [refetchYear]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`bookings-calendar-${location.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `location_id=eq.${location.id}`,
        },
        () => refetchYear()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [location.id, refetchYear]);

const fixedDatesForYear = useMemo(() => {
    const map = new Map<string, FixedCustomer[]>();
    for (const rule of fixedCustomers) {
      for (const date of expandFixedCustomerDates(rule, year)) {
        const key = ymd(date);
        const list = map.get(key) ?? [];
        list.push(rule);
        map.set(key, list);
      }
    }
    return map;
  }, [fixedCustomers, year]);

  const bookingCountByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of yearBookings) {
      if (b.status === "hủy") continue;
      const key = ymd(new Date(b.start_time));
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    for (const key of fixedDatesForYear.keys()) {
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [yearBookings, fixedDatesForYear]);

  const selectedDateStr = selectedDate ? ymd(selectedDate) : null;

  const fixedCustomersForSelectedDay = useMemo(() => {
    if (!selectedDateStr) return [];
    return fixedDatesForYear.get(selectedDateStr) ?? [];
  }, [fixedDatesForYear, selectedDateStr]);

  const dayBookings = useMemo(() => {
    if (!selectedDateStr) return [];
    return yearBookings
      .filter((b) => ymd(new Date(b.start_time)) === selectedDateStr)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [yearBookings, selectedDateStr]);

  function handleSelectDay(date: Date) {
    setSelectedDate(date);
    setDayMode("list");
    setEditing(null);
  }

  function bookingsInPeriod(period: Period) {
    if (!selectedDate) return [];
    const start = new Date(selectedDate);
    start.setHours(period.startHour, 0, 0, 0);
    const end = new Date(selectedDate);
    end.setHours(period.endHour, 0, 0, 0);
    return dayBookings.filter(
      (b) =>
        b.status !== "hủy" &&
        new Date(b.start_time) < end &&
        new Date(b.end_time) > start
    );
  }

  function fixedCustomersInPeriod(period: Period) {
    if (!selectedDate) return [];
    const start = new Date(selectedDate);
    start.setHours(period.startHour, 0, 0, 0);
    const end = new Date(selectedDate);
    end.setHours(period.endHour, 0, 0, 0);
    return fixedCustomersForSelectedDay.filter((rule) =>
      overlapsFixedTime(rule, start, end, selectedDate)
    );
  }

  function handlePeriodClick(period: Period) {
    if (fixedCustomersInPeriod(period).length > 0) return;
    const matches = bookingsInPeriod(period);
    if (matches.length === 0) {
      if (!canEdit) return;
      setEditing(null);
      setPeriodDefault(period);
      setDayMode("form");
    } else if (matches.length === 1) {
      setEditing(matches[0]);
      setPeriodDefault(null);
      setDayMode("form");
    }
    // Multiple overlapping bookings (e.g. outdoor area): leave the list visible below.
  }

  function backToCalendar() {
    setSelectedDate(null);
  }

  function prevMonth() {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-brand-forest">{location.name}</h2>
            <p className="text-sm text-brand-forest/60">
              {location.capacity} người
              {location.equipment ? ` · ${location.equipment}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-brand-forest/60 hover:bg-brand-cream"
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        {!selectedDate && (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex rounded-lg border border-brand-forest/20 p-0.5">
                <button
                  onClick={() => setView("month")}
                  className={`rounded-md px-3 py-1 text-sm font-medium transition ${
                    view === "month"
                      ? "bg-brand-forest text-brand-cream"
                      : "text-brand-forest"
                  }`}
                >
                  Tháng
                </button>
                <button
                  onClick={() => setView("year")}
                  className={`rounded-md px-3 py-1 text-sm font-medium transition ${
                    view === "year"
                      ? "bg-brand-forest text-brand-cream"
                      : "text-brand-forest"
                  }`}
                >
                  Năm
                </button>
              </div>

              {view === "month" ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={prevMonth}
                    className="rounded-md px-2 py-1 text-brand-forest hover:bg-brand-cream"
                    aria-label="Tháng trước"
                  >
                    ◀
                  </button>
                  <span className="min-w-28 text-center text-sm font-semibold text-brand-forest">
                    {MONTH_LABELS[month]} {year}
                  </span>
                  <button
                    onClick={nextMonth}
                    className="rounded-md px-2 py-1 text-brand-forest hover:bg-brand-cream"
                    aria-label="Tháng sau"
                  >
                    ▶
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setYear((y) => y - 1)}
                    className="rounded-md px-2 py-1 text-brand-forest hover:bg-brand-cream"
                    aria-label="Năm trước"
                  >
                    ◀
                  </button>
                  <span className="min-w-16 text-center text-sm font-semibold text-brand-forest">
                    {year}
                  </span>
                  <button
                    onClick={() => setYear((y) => y + 1)}
                    className="rounded-md px-2 py-1 text-brand-forest hover:bg-brand-cream"
                    aria-label="Năm sau"
                  >
                    ▶
                  </button>
                </div>
              )}
            </div>

            {loading && (
              <p className="mb-2 text-xs text-brand-forest/50">Đang tải lịch...</p>
            )}

            {view === "month" ? (
              <MonthCalendar
                year={year}
                month={month}
                bookingCountByDate={bookingCountByDate}
                onSelectDay={handleSelectDay}
              />
            ) : (
              <YearCalendar
                year={year}
                bookingCountByDate={bookingCountByDate}
                onSelectDay={(date) => {
                  setMonth(date.getMonth());
                  handleSelectDay(date);
                }}
              />
            )}
          </>
        )}

        {selectedDate && dayMode === "list" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <button
                onClick={backToCalendar}
                className="text-sm font-medium text-brand-forest hover:underline"
              >
                ← Quay lại lịch
              </button>
              <p className="text-sm font-semibold text-brand-forest">
                {selectedDate.toLocaleDateString("vi-VN", {
                  weekday: "long",
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {PERIODS.map((period) => {
                const fixedMatches = fixedCustomersInPeriod(period);
                const matches = bookingsInPeriod(period);
                const occupied = matches.length > 0 || fixedMatches.length > 0;
                return (
                  <button
                    key={period.key}
                    type="button"
                    onClick={() => handlePeriodClick(period)}
                    title={
                      fixedMatches.length > 0
                        ? `Khách cố định: ${fixedMatches.map((r) => r.customer_name).join(", ")}`
                        : undefined
                    }
                    className={`rounded-lg border-2 px-2 py-2 text-sm font-bold transition ${
                      occupied
                        ? "border-brand-amber bg-brand-amber text-white hover:bg-brand-amber/90"
                        : "border-brand-forest bg-brand-forest/10 text-brand-forest hover:bg-brand-forest/20"
                    }`}
                  >
                    {period.label}
                  </button>
                );
              })}
            </div>

            {location.type === "ghế ngoài" && (
              <p className="text-xs text-brand-forest/60">
                {dayBookings.filter((b) => b.status !== "hủy").length}/
                {location.capacity} chỗ đã đặt trong ngày (tính theo tổng lượt, có thể
                chồng giờ nếu khách ra vào khác thời điểm)
              </p>
            )}

            {fixedCustomersForSelectedDay.length > 0 && (
              <ul className="flex flex-col gap-2">
                {fixedCustomersForSelectedDay.map((rule) => (
                  <li
                    key={rule.id}
                    className="flex items-center justify-between rounded-lg border border-brand-forest/30 bg-brand-forest/5 px-3 py-2"
                  >
                    <span>
                      <span className="block font-medium text-brand-forest">
                        🔒 {rule.customer_name}
                      </span>
                      <span className="block text-xs text-brand-forest/60">
                        {rule.start_time.slice(0, 5)} - {rule.end_time.slice(0, 5)} · Khách
                        cố định
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {dayBookings.length === 0 && (
              <p className="text-sm text-brand-forest/50">
                Chưa có đặt chỗ nào ngày này.
              </p>
            )}

            <ul className="flex flex-col gap-2">
              {dayBookings.map((b) => (
                <li key={b.id}>
                  <button
                    onClick={() => {
                      setEditing(b);
                      setDayMode("form");
                    }}
                    className="flex w-full items-center justify-between rounded-lg border border-brand-forest/15 px-3 py-2 text-left hover:bg-brand-cream"
                  >
                    <span>
                      <span className="block font-medium text-brand-forest">
                        {b.customer_name}
                      </span>
                      <span className="block text-xs text-brand-forest/60">
                        {new Date(b.start_time).toLocaleTimeString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {" - "}
                        {new Date(b.end_time).toLocaleTimeString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        b.status === "hủy"
                          ? "bg-gray-200 text-gray-600"
                          : "bg-brand-amber/20 text-brand-amber"
                      }`}
                    >
                      {STATUS_LABEL[b.status]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            {canEdit && (
              <button
                onClick={() => {
                  setEditing(null);
                  setPeriodDefault(null);
                  setDayMode("form");
                }}
                className="mt-1 rounded-lg bg-brand-forest px-4 py-2 font-medium text-brand-cream hover:bg-brand-forest/90"
              >
                + Tạo đặt chỗ mới
              </button>
            )}
          </div>
        )}

        {selectedDate && dayMode === "form" && (
          <BookingForm
            location={location}
            booking={editing}
            discountRules={discountRules}
            pricingRules={pricingRules}
            preferredCustomers={preferredCustomers}
            defaultDate={selectedDate}
            defaultStartHour={periodDefault?.startHour}
            defaultEndHour={periodDefault?.endHour}
            canEdit={canEdit}
            onDone={() => {
              setDayMode("list");
              refetchYear();
            }}
            onCancelForm={() => setDayMode("list")}
          />
        )}
      </div>
    </div>
  );
}
