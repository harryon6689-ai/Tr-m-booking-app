"use server";

import { createClient } from "@/lib/supabase/server";
import type {
  BookingStatus,
  CustomerOrgType,
  Database,
  RecurrenceType,
} from "@/lib/types/database";
import { matchesFixedSchedule, ymd } from "@/lib/fixed-customers-utils";

export type CustomerCategory = CustomerOrgType | "khách cố định";

export interface HistoryFilters {
  locationId?: string;
  query?: string;
  status?: BookingStatus | "";
  customerCategory?: CustomerCategory | "";
  dateFrom?: string; // yyyy-mm-dd
  dateTo?: string; // yyyy-mm-dd
}

export interface HistoryRow {
  id: string;
  customer_name: string;
  phone: string | null;
  start_time: string;
  end_time: string;
  status: BookingStatus;
  final_price: number;
  deposit_amount: number;
  discount_applied: number;
  note: string | null;
  location_id: string;
  location_name: string;
  org_type: CustomerOrgType;
  organization_name: string | null;
}

export async function searchBookingHistory(
  filters: HistoryFilters
): Promise<HistoryRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("bookings")
    .select(
      "id, customer_name, phone, start_time, end_time, status, final_price, deposit_amount, discount_applied, note, location_id, org_type, organization_name, locations(name)"
    )
    .order("start_time", { ascending: false })
    .limit(300);

  if (filters.locationId) query = query.eq("location_id", filters.locationId);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.dateFrom) {
    query = query.gte("start_time", new Date(`${filters.dateFrom}T00:00:00`).toISOString());
  }
  if (filters.dateTo) {
    query = query.lte("start_time", new Date(`${filters.dateTo}T23:59:59.999`).toISOString());
  }
  if (filters.query) {
    const q = filters.query.replace(/[%,]/g, "");
    query = query.or(
      `customer_name.ilike.%${q}%,phone.ilike.%${q}%,organization_name.ilike.%${q}%`
    );
  }

  if (filters.customerCategory === "cá nhân" || filters.customerCategory === "công ty/tổ chức") {
    query = query.eq("org_type", filters.customerCategory);
  } else if (filters.customerCategory === "khách cố định") {
    const { data: fixedRows } = await supabase
      .from("fixed_customers")
      .select("phone")
      .not("phone", "is", null);
    const phones = (fixedRows ?? [])
      .map((r) => r.phone)
      .filter((p): p is string => Boolean(p));

    if (phones.length === 0) return [];
    query = query.in("phone", phones);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => {
    const { locations, ...rest } = row as typeof row & {
      locations: { name: string } | null;
    };
    return { ...rest, location_name: locations?.name ?? "?" };
  });
}

export interface CustomerHistoryFilters {
  phone?: string;
  name?: string; // used when phone is empty
  dateFrom?: string;
  dateTo?: string;
}

export async function getCustomerBookingHistory(
  filters: CustomerHistoryFilters
): Promise<HistoryRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("bookings")
    .select(
      "id, customer_name, phone, start_time, end_time, status, final_price, deposit_amount, discount_applied, note, location_id, org_type, organization_name, locations(name)"
    )
    .order("start_time", { ascending: false })
    .limit(500);

  if (filters.phone) {
    query = query.eq("phone", filters.phone);
  } else if (filters.name) {
    query = query.ilike("customer_name", filters.name);
  }

  if (filters.dateFrom) {
    query = query.gte("start_time", new Date(`${filters.dateFrom}T00:00:00`).toISOString());
  }
  if (filters.dateTo) {
    query = query.lte("start_time", new Date(`${filters.dateTo}T23:59:59.999`).toISOString());
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => {
    const { locations, ...rest } = row as typeof row & {
      locations: { name: string } | null;
    };
    return { ...rest, location_name: locations?.name ?? "?" };
  });
}

export interface CheckinFilters {
  dateFrom?: string; // yyyy-mm-dd, defaults to today
  dateTo?: string; // yyyy-mm-dd, defaults to today
  query?: string;
}

export type CheckinRow = Database["public"]["Tables"]["bookings"]["Row"] & {
  location_name: string;
  is_fixed_customer: boolean;
  recurrence_type: RecurrenceType | null;
  fixed_customer_id: string | null;
  occurrence_date: string | null;
};

/**
 * Bookings + matching "khách cố định" (fixed customer) occurrences for a given
 * day/range, soonest first, for front-desk check-in. Cancelled bookings are
 * included (shown with a status badge); fixed-customer rows are synthesized
 * (no real booking id) and tagged via `is_fixed_customer`/`recurrence_type`.
 */
export async function getCheckinList(
  filters: CheckinFilters = {}
): Promise<CheckinRow[]> {
  const supabase = await createClient();

  const today = new Date().toISOString().slice(0, 10);
  const dateFrom = filters.dateFrom || today;
  const dateTo = filters.dateTo || today;

  let bookingQuery = supabase
    .from("bookings")
    .select("*, locations(name)")
    .gte("start_time", new Date(`${dateFrom}T00:00:00`).toISOString())
    .lte("start_time", new Date(`${dateTo}T23:59:59.999`).toISOString())
    .order("start_time", { ascending: true })
    .limit(500);

  if (filters.query) {
    const q = filters.query.replace(/[%,]/g, "");
    bookingQuery = bookingQuery.or(`customer_name.ilike.%${q}%,phone.ilike.%${q}%`);
  }

  const { data: bookingsData, error: bookingsError } = await bookingQuery;
  if (bookingsError) throw bookingsError;

  const bookingRows: CheckinRow[] = (bookingsData ?? []).map((row) => {
    const { locations, ...rest } = row as typeof row & {
      locations: { name: string } | null;
    };
    return {
      ...rest,
      location_name: locations?.name ?? "?",
      is_fixed_customer: false,
      recurrence_type: null,
      fixed_customer_id: null,
      occurrence_date: null,
    };
  });

  let fixedQuery = supabase
    .from("fixed_customers")
    .select("*, locations(name)")
    .eq("active", true)
    .lte("effective_from", dateTo)
    .or(`effective_until.is.null,effective_until.gte.${dateFrom}`);

  if (filters.query) {
    const q = filters.query.replace(/[%,]/g, "");
    fixedQuery = fixedQuery.or(`customer_name.ilike.%${q}%,phone.ilike.%${q}%`);
  }

  const { data: fixedData, error: fixedError } = await fixedQuery;
  if (fixedError) throw fixedError;

  const { data: checkinsData, error: checkinsError } = await supabase
    .from("fixed_customer_checkins")
    .select("fixed_customer_id, occurrence_date, arrived")
    .gte("occurrence_date", dateFrom)
    .lte("occurrence_date", dateTo);
  if (checkinsError) throw checkinsError;

  const arrivedMap = new Map<string, boolean>();
  for (const row of checkinsData ?? []) {
    arrivedMap.set(`${row.fixed_customer_id}|${row.occurrence_date}`, row.arrived);
  }

  const fixedRows: CheckinRow[] = [];
  const rangeStart = new Date(`${dateFrom}T00:00:00`);
  const rangeEnd = new Date(`${dateTo}T00:00:00`);

  for (const row of fixedData ?? []) {
    const { locations, ...rule } = row as typeof row & {
      locations: { name: string } | null;
    };
    const cursor = new Date(rangeStart);
    while (cursor <= rangeEnd) {
      if (matchesFixedSchedule(rule, cursor)) {
        const dateStr = ymd(cursor);
        const arrived = arrivedMap.get(`${rule.id}|${dateStr}`) ?? false;
        fixedRows.push({
          id: `fc-${rule.id}-${dateStr}`,
          location_id: rule.location_id,
          location_name: locations?.name ?? "?",
          customer_name: rule.customer_name,
          phone: rule.phone,
          start_time: new Date(`${dateStr}T${rule.start_time}`).toISOString(),
          end_time: new Date(`${dateStr}T${rule.end_time}`).toISOString(),
          status: arrived ? "đã tới" : "đã đặt",
          deposit_amount: 0,
          discount_applied: 0,
          final_price: 0,
          note: rule.note,
          org_type: "cá nhân",
          organization_name: null,
          attendee_count: null,
          equipment_needed: [],
          equipment_note: null,
          pricing_rule_id: null,
          deposit_refunded: false,
          overage_fee: 0,
          vat_invoice_requested: false,
          vat_company_name: null,
          vat_company_address: null,
          vat_tax_code: null,
          vat_email: null,
          actual_drink_spend: null,
          overage_fee_paid: false,
          minimum_spend_shortfall_paid: false,
          created_by: rule.created_by,
          created_at: rule.created_at,
          updated_at: rule.updated_at,
          is_fixed_customer: true,
          recurrence_type: rule.recurrence_type,
          fixed_customer_id: rule.id,
          occurrence_date: dateStr,
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return [...bookingRows, ...fixedRows].sort((a, b) =>
    a.start_time.localeCompare(b.start_time)
  );
}

export interface RepeatCustomer {
  key: string;
  name: string;
  phone: string;
  visitCount: number;
  lastVisit: string;
}

export async function getRepeatCustomerStats(): Promise<RepeatCustomer[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bookings")
    .select("customer_name, phone, start_time, status")
    .neq("status", "hủy")
    .order("start_time", { ascending: false })
    .limit(2000);

  if (error) throw error;

  const map = new Map<string, RepeatCustomer>();

  for (const b of data ?? []) {
    const phone = b.phone?.trim() ?? "";
    const name = b.customer_name.trim();
    const key = phone || name.toLowerCase();
    if (!key) continue;

    const existing = map.get(key);
    if (existing) {
      existing.visitCount += 1;
    } else {
      // Rows are ordered by start_time desc, so the first hit is the most recent visit.
      map.set(key, {
        key,
        name,
        phone,
        visitCount: 1,
        lastVisit: b.start_time,
      });
    }
  }

  return Array.from(map.values())
    .filter((c) => c.visitCount >= 2)
    .sort((a, b) => b.visitCount - a.visitCount);
}
