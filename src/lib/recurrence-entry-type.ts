import type { RecurrenceType } from "@/lib/types/database";
import { WEEKDAY_LABELS } from "@/components/WeekdayPicker";
import { formatDayMonth } from "@/lib/fixed-customers-utils";

export type EntryType = "single" | "weekly" | "monthly" | "quarterly" | "yearly";

// Recurring entry types used to be admin-only; now any account with edit
// access to the module (quick_booking/floor_map) can use them, same as admin.
export const ENTRY_TYPE_OPTIONS: { value: EntryType; label: string; adminOnly: boolean }[] = [
  { value: "single", label: "Lẻ (theo ngày)", adminOnly: false },
  { value: "weekly", label: "Định kỳ - Tuần", adminOnly: false },
  { value: "monthly", label: "Định kỳ - Tháng", adminOnly: false },
  { value: "quarterly", label: "Định kỳ - Quý", adminOnly: false },
  { value: "yearly", label: "Định kỳ - Năm", adminOnly: false },
];

export function entryTypeLabel(entryType: EntryType): string {
  return ENTRY_TYPE_OPTIONS.find((o) => o.value === entryType)?.label ?? "";
}

export function entryTypeToRecurrenceType(entryType: EntryType): RecurrenceType | null {
  switch (entryType) {
    case "weekly":
      return "hàng tuần";
    case "monthly":
      return "hàng tháng";
    case "quarterly":
      return "hàng quý";
    case "yearly":
      return "hàng năm";
    default:
      return null;
  }
}

export function recurrenceLabel(
  entryType: EntryType,
  startDate: string,
  weekdays: number[] = [],
  monthDays: number[] = [],
  yearDates: string[] = []
): string {
  const d = new Date(`${startDate}T00:00:00`);
  switch (entryType) {
    case "weekly":
      return weekdays.length > 0
        ? `Lặp lại hàng tuần vào ${weekdays.map((w) => WEEKDAY_LABELS[w]).join(", ")}`
        : `Lặp lại hàng tuần vào ${WEEKDAY_LABELS[d.getDay()]}`;
    case "monthly":
      return monthDays.length > 0
        ? `Lặp lại hàng tháng vào ngày ${monthDays.join(", ")}`
        : `Lặp lại hàng tháng vào ngày ${d.getDate()}`;
    case "quarterly":
      return monthDays.length > 0
        ? `Lặp lại mỗi 3 tháng, vào ngày ${monthDays.join(", ")} (tính từ ngày bắt đầu)`
        : `Lặp lại mỗi 3 tháng, vào ngày ${d.getDate()} (tính từ ngày bắt đầu)`;
    case "yearly":
      return yearDates.length > 0
        ? `Lặp lại hàng năm vào ${yearDates.map(formatDayMonth).join(", ")}`
        : `Lặp lại hàng năm vào ${d.getDate()}/${d.getMonth() + 1}`;
    default:
      return "";
  }
}
