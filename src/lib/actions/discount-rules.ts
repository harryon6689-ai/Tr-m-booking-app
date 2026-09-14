"use server";

import { revalidatePath } from "next/cache";
import { requirePricingEditAccess } from "@/lib/actions/require-edit-access";

export async function updateDiscountRule(
  id: string,
  input: { default_percent: number; active: boolean }
) {
  const { supabase, error: authError } = await requirePricingEditAccess();
  if (authError) return { error: authError };

  const { error } = await supabase.from("discount_rules").update(input).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/discount-rules");
  return { error: null };
}
