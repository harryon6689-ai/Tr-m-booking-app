import { createClient } from "@/lib/supabase/server";

export async function getDiscountRules() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("discount_rules")
    .select("*")
    .eq("active", true);

  if (error) throw error;
  return data;
}

export async function getAllDiscountRules() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("discount_rules")
    .select("*")
    .order("customer_type", { ascending: true });

  if (error) throw error;
  return data;
}
