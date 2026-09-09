import { createClient } from "@/lib/supabase/server";

export async function getActivePricingRules() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pricing_rules")
    .select("*")
    .eq("active", true)
    .order("display_order", { ascending: true });

  if (error) throw error;
  return data;
}

export async function getAllPricingRules() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pricing_rules")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) throw error;
  return data;
}
