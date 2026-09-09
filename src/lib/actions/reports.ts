"use server";

import { createClient } from "@/lib/supabase/server";

export interface RevenueFilters {
  dateFrom?: string;
  dateTo?: string;
}

export interface LocationRevenue {
  location_id: string;
  location_name: string;
  revenue: number;
  count: number;
}

export interface DayRevenue {
  date: string;
  revenue: number;
}

export interface RevenueSummary {
  totalRevenue: number;
  totalDeposit: number;
  bookingCount: number;
  cancelledCount: number;
  byLocation: LocationRevenue[];
  byDay: DayRevenue[];
}

const EMPTY_SUMMARY: RevenueSummary = {
  totalRevenue: 0,
  totalDeposit: 0,
  bookingCount: 0,
  cancelledCount: 0,
  byLocation: [],
  byDay: [],
};

export async function getRevenueSummary(
  filters: RevenueFilters
): Promise<RevenueSummary> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return EMPTY_SUMMARY;

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return EMPTY_SUMMARY;

  let query = supabase
    .from("bookings")
    .select("id, location_id, final_price, deposit_amount, status, start_time, locations(name)")
    .order("start_time", { ascending: true });

  if (filters.dateFrom) {
    query = query.gte("start_time", new Date(`${filters.dateFrom}T00:00:00`).toISOString());
  }
  if (filters.dateTo) {
    query = query.lte("start_time", new Date(`${filters.dateTo}T23:59:59.999`).toISOString());
  }

  const { data, error } = await query;
  if (error) throw error;

  let totalRevenue = 0;
  let totalDeposit = 0;
  let bookingCount = 0;
  let cancelledCount = 0;
  const byLocationMap = new Map<string, { name: string; revenue: number; count: number }>();
  const byDayMap = new Map<string, number>();

  for (const row of data ?? []) {
    const b = row as typeof row & { locations: { name: string } | null };

    if (b.status === "hủy") {
      cancelledCount += 1;
      continue;
    }

    bookingCount += 1;
    totalRevenue += b.final_price;
    totalDeposit += b.deposit_amount;

    const locName = b.locations?.name ?? "?";
    const loc = byLocationMap.get(b.location_id) ?? { name: locName, revenue: 0, count: 0 };
    loc.revenue += b.final_price;
    loc.count += 1;
    byLocationMap.set(b.location_id, loc);

    const day = b.start_time.slice(0, 10);
    byDayMap.set(day, (byDayMap.get(day) ?? 0) + b.final_price);
  }

  return {
    totalRevenue,
    totalDeposit,
    bookingCount,
    cancelledCount,
    byLocation: Array.from(byLocationMap.entries())
      .map(([location_id, v]) => ({
        location_id,
        location_name: v.name,
        revenue: v.revenue,
        count: v.count,
      }))
      .sort((a, b) => b.revenue - a.revenue),
    byDay: Array.from(byDayMap.entries())
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}
