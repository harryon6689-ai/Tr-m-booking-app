"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { BookingStatus, CustomerOrgType } from "@/lib/types/database";
import { matchesFixedSchedule, overlapsFixedTime } from "@/lib/fixed-customers-utils";
import { requireEditAccess } from "@/lib/actions/require-edit-access";

export interface BookingInput {
  location_id: string;
  customer_name: string;
  phone: string;
  start_time: string; // ISO
  end_time: string; // ISO
  status: BookingStatus;
  deposit_amount: number;
  discount_applied: number;
  final_price: number;
  note: string;
  org_type: CustomerOrgType;
  organization_name: string | null;
  attendee_count: number | null;
  equipment_needed: string[];
  equipment_note: string;
  pricing_rule_id: string | null;
  vat_invoice_requested: boolean;
  vat_company_name: string | null;
  vat_company_address: string | null;
  vat_tax_code: string | null;
  vat_email: string | null;
  actual_drink_spend: number;
  overage_fee: number;
  overage_fee_paid: boolean;
  minimum_spend_shortfall_paid: boolean;
  seat_number: string | null;
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Rooms/boxes host one party at a time, so ANY overlap blocks the new booking.
 * "Khu ngồi ngoài" is capacity-based (100 seats) — overlap is only blocked once
 * the number of already-booked seats in that time range reaches capacity.
 */
async function checkOverlap(
  supabase: Supabase,
  locationId: string,
  startTime: string,
  endTime: string,
  seatNumber: string | null,
  excludeBookingId?: string
): Promise<string | null> {
  const { data: location, error: locationError } = await supabase
    .from("locations")
    .select("type, capacity")
    .eq("id", locationId)
    .single();

  if (locationError || !location) return "Không tìm thấy vị trí đặt chỗ.";

  const fixedConflict = await checkFixedCustomerConflict(
    supabase,
    locationId,
    startTime,
    endTime,
    location.type,
    seatNumber
  );
  if (fixedConflict) return fixedConflict;

  if (location.type === "ghế ngoài" && seatNumber) {
    const seatConflict = await checkSeatConflict(
      supabase,
      locationId,
      seatNumber,
      startTime,
      endTime,
      excludeBookingId
    );
    if (seatConflict) return seatConflict;
  }

  let query = supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("location_id", locationId)
    .neq("status", "hủy")
    .lt("start_time", endTime)
    .gt("end_time", startTime);

  if (excludeBookingId) {
    query = query.neq("id", excludeBookingId);
  }

  const { count, error } = await query;
  if (error) return error.message;

  const overlapping = count ?? 0;
  const limit = location.type === "ghế ngoài" ? location.capacity : 1;

  if (overlapping >= limit) {
    return location.type === "ghế ngoài"
      ? `Khu ngồi ngoài đã kín chỗ (${location.capacity} chỗ) trong khung giờ này.`
      : "Khung giờ này đã có khách đặt, vui lòng chọn giờ khác.";
  }

  return null;
}

/** Blocks a booking that would overlap an active recurring "khách cố định" schedule. */
async function checkFixedCustomerConflict(
  supabase: Supabase,
  locationId: string,
  startTime: string,
  endTime: string,
  locationType: string,
  seatNumber: string | null
): Promise<string | null> {
  const start = new Date(startTime);
  const end = new Date(endTime);

  const { data: rules, error } = await supabase
    .from("fixed_customers")
    .select("*")
    .eq("location_id", locationId)
    .eq("active", true);

  if (error || !rules) return null;

  for (const rule of rules) {
    if (
      matchesFixedSchedule(rule, start) &&
      overlapsFixedTime(rule, start, end, start)
    ) {
      // Outdoor seats are independent — a different, explicitly assigned seat
      // doesn't conflict even if the time overlaps.
      if (
        locationType === "ghế ngoài" &&
        seatNumber &&
        rule.seat_number &&
        rule.seat_number !== seatNumber
      ) {
        continue;
      }
      return `Trùng lịch khách cố định "${rule.customer_name}" (${rule.start_time.slice(
        0,
        5
      )}-${rule.end_time.slice(0, 5)}). Vui lòng chọn giờ khác.`;
    }
  }

  return null;
}

/**
 * For "ghế ngoài", two bookings can only conflict if they claim the SAME
 * specific seat with an overlapping time — otherwise they just coexist
 * within the location's overall capacity (checked separately).
 */
async function checkSeatConflict(
  supabase: Supabase,
  locationId: string,
  seatNumber: string,
  startTime: string,
  endTime: string,
  excludeBookingId?: string
): Promise<string | null> {
  let query = supabase
    .from("bookings")
    .select("customer_name, start_time, end_time")
    .eq("location_id", locationId)
    .eq("seat_number", seatNumber)
    .neq("status", "hủy")
    .lt("start_time", endTime)
    .gt("end_time", startTime)
    .limit(1);

  if (excludeBookingId) {
    query = query.neq("id", excludeBookingId);
  }

  const { data, error } = await query;
  if (error) return error.message;

  if (data && data.length > 0) {
    const conflict = data[0];
    return `Vị trí ${seatNumber} đã có khách "${conflict.customer_name}" đặt trùng giờ (${new Date(
      conflict.start_time
    ).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}-${new Date(
      conflict.end_time
    ).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}). Vui lòng chọn giờ khác.`;
  }

  return null;
}

export async function createBooking(input: BookingInput) {
  const supabase = await createClient();
  const { userId, error: authError } = await requireEditAccess(supabase);

  if (authError) return { error: authError };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (new Date(input.start_time) < today) {
    return { error: "Không thể tạo đặt chỗ cho ngày đã qua." };
  }

  if (input.status !== "hủy") {
    const conflict = await checkOverlap(
      supabase,
      input.location_id,
      input.start_time,
      input.end_time,
      input.seat_number
    );
    if (conflict) return { error: conflict };
  }

  const { error } = await supabase.from("bookings").insert({
    ...input,
    created_by: userId,
  });

  if (error) return { error: error.message };

  revalidatePath("/");
  return { error: null };
}

export async function updateBooking(id: string, input: BookingInput) {
  const supabase = await createClient();
  const { userId, error: authError } = await requireEditAccess(supabase);

  if (authError) return { error: authError };

  if (input.status !== "hủy") {
    const conflict = await checkOverlap(
      supabase,
      input.location_id,
      input.start_time,
      input.end_time,
      input.seat_number,
      id
    );
    if (conflict) return { error: conflict };
  }

  const { error } = await supabase
    .from("bookings")
    .update({ ...input, created_by: userId })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/");
  return { error: null };
}

export async function cancelBooking(id: string) {
  const supabase = await createClient();
  const { userId, error: authError } = await requireEditAccess(supabase);

  if (authError) return { error: authError };

  const { error } = await supabase
    .from("bookings")
    .update({ status: "hủy", created_by: userId })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/");
  return { error: null };
}

export async function setBookingArrived(id: string, arrived: boolean) {
  const supabase = await createClient();
  const { userId, error: authError } = await requireEditAccess(supabase);

  if (authError) return { error: authError };

  const { error } = await supabase
    .from("bookings")
    .update({ status: arrived ? "đã tới" : "đã đặt", created_by: userId })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/check-in");
  revalidatePath("/");
  return { error: null };
}

export async function setDepositRefunded(id: string, refunded: boolean) {
  const supabase = await createClient();
  const { error: authError } = await requireEditAccess(supabase);

  if (authError) return { error: authError };

  const { error } = await supabase
    .from("bookings")
    .update({ deposit_refunded: refunded })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/check-in");
  return { error: null };
}

export async function setOverageFeePaid(id: string, paid: boolean) {
  const supabase = await createClient();
  const { error: authError } = await requireEditAccess(supabase);

  if (authError) return { error: authError };

  const { error } = await supabase
    .from("bookings")
    .update({ overage_fee_paid: paid })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/check-in");
  return { error: null };
}

export async function setMinimumSpendShortfallPaid(id: string, paid: boolean) {
  const supabase = await createClient();
  const { error: authError } = await requireEditAccess(supabase);

  if (authError) return { error: authError };

  const { error } = await supabase
    .from("bookings")
    .update({ minimum_spend_shortfall_paid: paid })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/check-in");
  return { error: null };
}

export async function setOverageFee(id: string, amount: number) {
  const supabase = await createClient();
  const { error: authError } = await requireEditAccess(supabase);

  if (authError) return { error: authError };

  const { error } = await supabase
    .from("bookings")
    .update({ overage_fee: amount })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/check-in");
  return { error: null };
}
