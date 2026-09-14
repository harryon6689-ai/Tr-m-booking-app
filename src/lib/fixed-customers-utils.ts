import type { Database, RecurrenceType } from "@/lib/types/database";

type FixedCustomer = Database["public"]["Tables"]["fixed_customers"]["Row"];

export function ymd(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** yyyy-mm-dd -> dd/mm (year dropped) — used for "hàng năm" dates, where the
 * stored year is arbitrary and only day+month recur. */
export function formatDayMonth(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

/** Does this recurring rule occur on the given calendar date? */
export function matchesFixedSchedule(rule: FixedCustomer, date: Date): boolean {
  const dateStr = ymd(date);
  if (dateStr < rule.effective_from) return false;
  if (rule.effective_until && dateStr > rule.effective_until) return false;

  switch (rule.recurrence_type) {
    case "hàng tuần":
      return (rule.weekday ?? []).includes(date.getDay());
    case "hàng tháng":
      return (rule.day_of_month ?? []).includes(date.getDate());
    case "hàng quý": {
      if (!(rule.day_of_month ?? []).includes(date.getDate())) return false;
      const anchor = new Date(`${rule.effective_from}T00:00:00`);
      const monthsDiff =
        (date.getFullYear() - anchor.getFullYear()) * 12 +
        (date.getMonth() - anchor.getMonth());
      return monthsDiff >= 0 && monthsDiff % 3 === 0;
    }
    case "hàng năm":
      // Each entry's year is irrelevant — only its day+month recurs, every year.
      return (rule.custom_dates ?? []).some((ds) => {
        const d = new Date(`${ds}T00:00:00`);
        return d.getDate() === date.getDate() && d.getMonth() === date.getMonth();
      });
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

/**
 * Default "Hiệu lực đến" suggested when staff pick a recurrence type — still
 * freely editable afterwards. Returns null for "ngày cụ thể" (no recurrence).
 */
export function defaultEffectiveUntil(
  recurrenceType: RecurrenceType,
  effectiveFromStr: string
): string | null {
  if (!effectiveFromStr) return null;
  const d = new Date(`${effectiveFromStr}T00:00:00`);
  switch (recurrenceType) {
    case "hàng tuần":
    case "hàng tháng":
      d.setMonth(d.getMonth() + 1);
      break;
    case "hàng quý":
      d.setMonth(d.getMonth() + 3);
      break;
    case "hàng năm":
      d.setFullYear(d.getFullYear() + 1);
      break;
    default:
      return null;
  }
  return ymd(d);
}

/**
 * Walks backward from `boundDateStr` to the rule's `effective_from`, looking
 * for the last calendar date that actually matches the recurrence schedule.
 */
export function lastOccurrenceOnOrBefore(
  rule: FixedCustomer,
  boundDateStr: string
): string | null {
  if (!boundDateStr) return null;
  const from = new Date(`${rule.effective_from}T00:00:00`);
  const cursor = new Date(`${boundDateStr}T00:00:00`);
  while (cursor >= from) {
    if (matchesFixedSchedule(rule, cursor)) return ymd(cursor);
    cursor.setDate(cursor.getDate() - 1);
  }
  return null;
}

/**
 * The rule's last `count` occurrence dates on or before `boundDateStr`,
 * newest first (e.g. [lastVisit, secondLastVisit]).
 */
export function lastOccurrences(
  rule: FixedCustomer,
  boundDateStr: string,
  count: number
): string[] {
  if (!boundDateStr) return [];
  const from = new Date(`${rule.effective_from}T00:00:00`);
  const cursor = new Date(`${boundDateStr}T00:00:00`);
  const dates: string[] = [];
  while (cursor >= from && dates.length < count) {
    if (matchesFixedSchedule(rule, cursor)) dates.push(ymd(cursor));
    cursor.setDate(cursor.getDate() - 1);
  }
  return dates;
}

/**
 * True only on the customer's actual last scheduled visit before
 * `effective_until`, and on the visit one period before that — the two
 * days staff will actually see the customer in person to bring up renewal.
 */
export function needsRenewalReminder(rule: FixedCustomer, todayStr: string): boolean {
  if (!rule.active || !rule.effective_until) return false;
  const reminderDates = lastOccurrences(rule, rule.effective_until, 2);
  if (reminderDates.length === 0) return todayStr === rule.effective_until;
  return reminderDates.includes(todayStr);
}

/** yyyy-mm-dd -> dd/mm/yyyy for display. */
export function formatDateDMY(dateStr: string | null): string {
  if (!dateStr) return "-";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}
