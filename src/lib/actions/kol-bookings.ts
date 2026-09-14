"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { BookingStatus } from "@/lib/types/database";
import { requireEditAccess } from "@/lib/actions/require-edit-access";

async function requireAdmin(action: string = "thực hiện thao tác này") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase, error: "Bạn chưa đăng nhập." as const, userId: null };

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { supabase, error: `Chỉ admin mới có quyền ${action}.`, userId: null };
  }

  return { supabase, error: null, userId: user.id };
}

export interface KolBookingInput {
  kol_name: string;
  booked_by_name: string;
  phone: string;
  platform: string;
  channel_link: string;
  follower_count: number | null;
  visit_date: string; // yyyy-mm-dd
  start_time: string | null; // HH:mm
  end_time: string | null; // HH:mm
  deal_type: string;
  content_deliverable: string;
  review_price: number;
  gift_drink: boolean;
  gift_drink_quantity: number | null;
  gift_cake: boolean;
  gift_cake_quantity: number | null;
  has_reviewed: boolean;
  effectiveness_rating: number;
  video_links: string[];
  status: BookingStatus;
  note: string;
}

export type ReviewStatusFilter = "" | "reviewed" | "not_reviewed" | "cancelled";
export type EffectiveFilter = "" | "1" | "2" | "3" | "4" | "5";

export interface KolBookingFilters {
  dateFrom?: string;
  dateTo?: string;
  query?: string;
  reviewStatus?: ReviewStatusFilter;
  effectiveFilter?: EffectiveFilter;
}

export async function getKolBookings(filters: KolBookingFilters = {}) {
  const supabase = await createClient();

  let query = supabase
    .from("kol_bookings")
    .select("*, users(name)")
    .order("visit_date", { ascending: false });

  if (filters.dateFrom) query = query.gte("visit_date", filters.dateFrom);
  if (filters.dateTo) query = query.lte("visit_date", filters.dateTo);
  if (filters.query) {
    const q = filters.query.replace(/[%,]/g, "");
    query = query.ilike("kol_name", `%${q}%`);
  }
  if (filters.reviewStatus === "reviewed") query = query.eq("has_reviewed", true);
  if (filters.reviewStatus === "not_reviewed") query = query.eq("has_reviewed", false);
  if (filters.reviewStatus === "cancelled") query = query.eq("status", "hủy");
  if (filters.effectiveFilter) {
    query = query.gte("effectiveness_rating", Number(filters.effectiveFilter));
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => {
    const { users, ...rest } = row as typeof row & { users: { name: string } | null };
    return { ...rest, created_by_name: users?.name ?? null };
  });
}

export async function createKolBooking(input: KolBookingInput) {
  const supabase = await createClient();
  const { userId, error: authError } = await requireEditAccess(supabase);

  if (authError) return { error: authError };

  const { error } = await supabase.from("kol_bookings").insert({
    ...input,
    created_by: userId,
  });

  if (error) return { error: error.message };

  revalidatePath("/kol");
  return { error: null };
}

/**
 * Editing an existing KOL booking's info (name, phone, deal, price, etc.) is
 * admin-only — staff can only update review status and gift quantities via
 * setKolReviewed/setKolStatus/setKolGift, not this full-record update.
 */
export async function updateKolBooking(id: string, input: KolBookingInput) {
  const { supabase, userId, error: authError } = await requireAdmin("sửa thông tin KOL");

  if (authError) return { error: authError };

  const { error } = await supabase
    .from("kol_bookings")
    .update({ ...input, created_by: userId })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/kol");
  return { error: null };
}

/** Staff-safe: only touches gift fields, never other KOL info. */
export async function setKolGift(
  id: string,
  giftDrink: boolean,
  giftDrinkQuantity: number | null,
  giftCake: boolean,
  giftCakeQuantity: number | null
) {
  const supabase = await createClient();
  const { userId, error: authError } = await requireEditAccess(supabase);

  if (authError) return { error: authError };

  const { error } = await supabase
    .from("kol_bookings")
    .update({
      gift_drink: giftDrink,
      gift_drink_quantity: giftDrink ? giftDrinkQuantity : null,
      gift_cake: giftCake,
      gift_cake_quantity: giftCake ? giftCakeQuantity : null,
      created_by: userId,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/kol");
  return { error: null };
}

export async function setKolReviewed(id: string, hasReviewed: boolean) {
  const supabase = await createClient();
  const { userId, error: authError } = await requireEditAccess(supabase);

  if (authError) return { error: authError };

  const { error } = await supabase
    .from("kol_bookings")
    .update({ has_reviewed: hasReviewed, created_by: userId })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/kol");
  return { error: null };
}

export async function setKolEffectivenessRating(id: string, rating: number) {
  const supabase = await createClient();
  const { userId, error: authError } = await requireEditAccess(supabase);

  if (authError) return { error: authError };

  const clamped = Math.max(0, Math.min(5, rating));

  const { error } = await supabase
    .from("kol_bookings")
    .update({ effectiveness_rating: clamped, created_by: userId })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/kol");
  return { error: null };
}

export async function setKolStatus(id: string, status: BookingStatus) {
  const supabase = await createClient();
  const { userId, error: authError } = await requireEditAccess(supabase);

  if (authError || !userId) return { error: authError ?? "Bạn chưa đăng nhập." };

  // Cancelling a KOL is admin-only — staff may only toggle Đã Review / Chưa Review.
  if (status === "hủy") {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .single();
    if (profile?.role !== "admin") {
      return { error: "Chỉ admin mới có quyền hủy lịch KOL." };
    }
  }

  const { error } = await supabase
    .from("kol_bookings")
    .update({ status, created_by: userId })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/kol");
  return { error: null };
}

export async function deleteKolBooking(id: string) {
  const { supabase, error: authError } = await requireAdmin("xóa lịch KOL");

  if (authError) return { error: authError };

  const { error } = await supabase.from("kol_bookings").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/kol");
  return { error: null };
}

export async function cancelKolBooking(id: string) {
  const { supabase, userId, error: authError } = await requireAdmin("hủy lịch KOL");

  if (authError) return { error: authError };

  const { error } = await supabase
    .from("kol_bookings")
    .update({ status: "hủy", created_by: userId })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/kol");
  return { error: null };
}
