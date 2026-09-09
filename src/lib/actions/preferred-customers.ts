"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { CustomerOrgType, CustomerType } from "@/lib/types/database";

export interface PreferredCustomerInput {
  name: string;
  phone: string;
  customer_type: CustomerType;
  org_type: CustomerOrgType;
  organization_name: string | null;
  custom_discount_percent: number | null;
  equipment_needed: string[];
  equipment_note: string;
  note: string;
  active: boolean;
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
    return { supabase, error: "Chỉ admin mới có quyền quản lý khách VIP/KOL." as const };
  }

  return { supabase, error: null, userId: user.id };
}

export async function getPreferredCustomers() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("preferred_customers")
    .select("*")
    .eq("active", true);

  if (error) throw error;
  return data;
}

export async function getAllPreferredCustomers() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("preferred_customers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function createPreferredCustomer(input: PreferredCustomerInput) {
  const { supabase, error: authError, userId } = await requireAdmin();
  if (authError) return { error: authError };

  const { error } = await supabase.from("preferred_customers").insert({
    ...input,
    created_by: userId,
  });

  if (error) return { error: error.message };

  revalidatePath("/preferred-customers");
  return { error: null };
}

export async function updatePreferredCustomer(
  id: string,
  input: PreferredCustomerInput
) {
  const { supabase, error: authError, userId } = await requireAdmin();
  if (authError) return { error: authError };

  const { error } = await supabase
    .from("preferred_customers")
    .update({ ...input, created_by: userId })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/preferred-customers");
  return { error: null };
}

export async function deletePreferredCustomer(id: string) {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const { error } = await supabase.from("preferred_customers").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/preferred-customers");
  return { error: null };
}
