"use client";

import MonthCalendar from "@/components/calendar/MonthCalendar";

const MONTH_LABELS = [
  "Tháng 1",
  "Tháng 2",
  "Tháng 3",
  "Tháng 4",
  "Tháng 5",
  "Tháng 6",
  "Tháng 7",
  "Tháng 8",
  "Tháng 9",
  "Tháng 10",
  "Tháng 11",
  "Tháng 12",
];

interface YearCalendarProps {
  year: number;
  bookingCountByDate: Map<string, number>;
  selectedDateStr?: string | null;
  onSelectDay: (date: Date) => void;
}

export default function YearCalendar({
  year,
  bookingCountByDate,
  selectedDateStr,
  onSelectDay,
}: YearCalendarProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {MONTH_LABELS.map((label, month) => (
        <div key={label} className="rounded-lg border border-brand-forest/10 p-2">
          <p className="mb-1 text-center text-xs font-semibold text-brand-forest/70">
            {label}
          </p>
          <MonthCalendar
            year={year}
            month={month}
            bookingCountByDate={bookingCountByDate}
            selectedDateStr={selectedDateStr}
            onSelectDay={onSelectDay}
            compact
          />
        </div>
      ))}
    </div>
  );
}
