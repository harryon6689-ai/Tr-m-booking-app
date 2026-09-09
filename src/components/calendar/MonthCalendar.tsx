"use client";

const WEEKDAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

export function ymd(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

interface MonthCalendarProps {
  year: number;
  month: number; // 0-11
  bookingCountByDate: Map<string, number>;
  selectedDateStr?: string | null;
  onSelectDay: (date: Date) => void;
  compact?: boolean;
}

export default function MonthCalendar({
  year,
  month,
  bookingCountByDate,
  selectedDateStr,
  onSelectDay,
  compact = false,
}: MonthCalendarProps) {
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = (firstOfMonth.getDay() + 6) % 7; // Monday = 0

  const todayStr = ymd(new Date());

  const cells: (Date | null)[] = [
    ...Array(leading).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      <div
        className={`grid grid-cols-7 ${compact ? "gap-0.5 text-[11px]" : "gap-1.5 text-sm"}`}
      >
        {!compact &&
          WEEKDAY_LABELS.map((w) => (
            <div
              key={w}
              className="pb-1 text-center font-semibold text-brand-forest/50"
            >
              {w}
            </div>
          ))}
        {cells.map((date, i) => {
          if (!date) {
            return <div key={i} className={compact ? "h-5" : "h-10"} />;
          }
          const dateStr = ymd(date);
          const count = bookingCountByDate.get(dateStr) ?? 0;
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDateStr;
          const isPast = dateStr < todayStr;

          return (
            <button
              key={i}
              type="button"
              disabled={isPast}
              onClick={() => onSelectDay(date)}
              title={isPast ? "Ngày đã qua" : undefined}
              className={`flex items-center justify-center rounded-md font-bold transition ${
                compact ? "h-6" : "h-11"
              } ${
                isPast
                  ? "cursor-not-allowed text-brand-forest/25"
                  : isSelected
                  ? "bg-brand-forest text-brand-cream"
                  : count > 0
                  ? "bg-brand-amber text-white hover:bg-brand-amber/90"
                  : "text-brand-forest hover:bg-brand-cream"
              } ${
                isToday && !isSelected && count === 0
                  ? "ring-2 ring-brand-forest/60"
                  : ""
              }`}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
