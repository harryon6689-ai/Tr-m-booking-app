import type { Database } from "@/lib/types/database";

type FixedCustomer = Database["public"]["Tables"]["fixed_customers"]["Row"];

export function ymd(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Does this recurring rule occur on the given calendar date? */
export function matchesFixedSchedule(rule: FixedCustomer, date: Date): boolean {
  const dateStr = ymd(date);
  if (dateStr < rule.effective_from) return false;
  if (rule.effective_until && dateStr > rule.effective_until) return false;

  switch (rule.recurrence_type) {
    case "hàng tuần":
      return rule.weekday === date.getDay();
    case "hàng tháng":
      return rule.day_of_month === date.getDate();
    case "ngày cụ thể":
      return (rule.custom_dates ?? []).includes(dateStr);
    default:
      return false;
  }
}

/** Do [aStart, aEnd) overlap the rule's start_time/end_time on the given day? */
export function overlapsFixedTime(
  rule: Pick<FixedCustomer, "start_time" | "end_time">,
  aStart: Date,
  aEnd: Date,
  day: Date
): boolean {
  const [bsh, bsm] = rule.start_time.split(":").map(Number);
  const [beh, bem] = rule.end_time.split(":").map(Number);
  const bStart = new Date(day);
  bStart.setHours(bsh, bsm, 0, 0);
  const bEnd = new Date(day);
  bEnd.setHours(beh, bem, 0, 0);
  return aStart < bEnd && aEnd > bStart;
}

/** Expand a rule's recurrence into concrete matching dates within a given year. */
export function expandFixedCustomerDates(rule: FixedCustomer, year: number): Date[] {
  const dates: Date[] = [];
  const cursor = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  while (cursor <= end) {
    if (matchesFixedSchedule(rule, cursor)) {
      dates.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}
