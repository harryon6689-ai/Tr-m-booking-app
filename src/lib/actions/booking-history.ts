"use server";

import { createClient } from "@/lib/supabase/server";
import type { BookingStatus, CustomerOrgType } from "@/lib/types/database";

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
