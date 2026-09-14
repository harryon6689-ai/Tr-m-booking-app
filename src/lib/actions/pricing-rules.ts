"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePricingEditAccess } from "@/lib/actions/require-edit-access";
import type { LocationType, PricingMode } from "@/lib/types/database";

export interface PricingRuleInput {
  location_type: LocationType;
  rule_name: string;
  min_attendees: number | null;
  max_attendees: number | null;
  pricing_mode: PricingMode;
  free_hours: number | null;
  overage_fee_per_hour: number | null;
  flat_price: number | null;
  flat_price_hours: number | null;
  requires_drink_per_person: boolean;
  active: boolean;
  display_order: number;
}

export async function getPricingRules() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pricing_rules")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) throw error;
  return data;
}

export async function createPricingRule(input: PricingRuleInput) {
  const { supabase, error: authError } = await requirePricingEditAccess();
  if (authError) return { error: authError };

  const { error } = await supabase.from("pricing_rules").insert(input);
  if (error) return { error: error.message };

  revalidatePath("/discount-rules");
  return { error: null };
}

export async function updatePricingRule(id: string, input: PricingRuleInput) {
  const { supabase, error: authError } = await requirePricingEditAccess();
  if (authError) return { error: authError };

  const { error } = await supabase.from("pricing_rules").update(input).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/discount-rules");
  return { error: null };
}

export async function setPricingRuleActive(id: string, active: boolean) {
  const { supabase, error: authError } = await requirePricingEditAccess();
  if (authError) return { error: authError };

  const { error } = await supabase
    .from("pricing_rules")
    .update({ active })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/discount-rules");
  return { error: null };
}
