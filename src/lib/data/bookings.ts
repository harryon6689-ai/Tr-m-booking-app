import { createClient } from "@/lib/supabase/server";

/** Start/end of a given calendar day (local server time) as ISO strings. */
function dayBounds(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function getBookingsForDay(date: Date = new Date()) {
  const { start, end } = dayBounds(date);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .gte("start_time", start)
    .lte("start_time", end)
    .order("start_time", { ascending: true });

  if (error) throw error;
  return data;
}
