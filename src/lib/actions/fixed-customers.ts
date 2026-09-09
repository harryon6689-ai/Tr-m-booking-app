"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { RecurrenceType } from "@/lib/types/database";

export interface FixedCustomerInput {
  location_id: string;
  customer_name: string;
  phone: string;
  recurrence_type: RecurrenceType;
  weekday: number | null;
  day_of_month: number | null;
  custom_dates: string[] | null;
  start_time: string; // "HH:mm"
  end_time: string; // "HH:mm"
  effective_from: string; // "yyyy-mm-dd"
  effective_until: string | null;
  active: boolean;
  note: string;
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase, error: "Bạn chưa đăng nhập." as const };

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { supabase, error: "Chỉ admin mới có quyền quản lý khách cố định." as const };
  }

  return { supabase, error: null, userId: user.id };
}

export async function getFixedCustomersForLocation(locationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fixed_customers")
    .select("*")
    .eq("location_id", locationId)
    .eq("active", true);

  if (error) throw error;
  return data;
}

export async function getFixedCustomers() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fixed_customers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function createFixedCustomer(input: FixedCustomerInput) {
  const { supabase, error: authError, userId } = await requireAdmin();
  if (authError) return { error: authError };

  const { error } = await supabase.from("fixed_customers").insert({
    ...input,
    created_by: userId,
  });

  if (error) return { error: error.message };

  revalidatePath("/fixed-customers");
  revalidatePath("/");
  return { error: null };
}

export async function updateFixedCustomer(id: string, input: FixedCustomerInput) {
  const { supabase, error: authError, userId } = await requireAdmin();
  if (authError) return { error: authError };

  const { error } = await supabase
    .from("fixed_customers")
    .update({ ...input, created_by: userId })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/fixed-customers");
  revalidatePath("/");
  return { error: null };
}

export async function deleteFixedCustomer(id: string) {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const { error } = await supabase.from("fixed_customers").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/fixed-customers");
  revalidatePath("/");
  return { error: null };
}
