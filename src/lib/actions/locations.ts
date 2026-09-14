"use server";

import { revalidatePath } from "next/cache";
import { requirePricingEditAccess } from "@/lib/actions/require-edit-access";

export interface LocationPolicyInput {
  minimumSpend: number | null;
  includedHours: number;
  overageFeePerHour: number | null;
}

export async function updateLocationPolicy(
  locationId: string,
  input: LocationPolicyInput
) {
  const { supabase, error: authError } = await requirePricingEditAccess();
  if (authError) return { error: authError };

  const { error } = await supabase
    .from("locations")
    .update({
      minimum_spend: input.minimumSpend,
      included_hours: input.includedHours,
      overage_fee_per_hour: input.overageFeePerHour,
    })
    .eq("id", locationId);

  if (error) return { error: error.message };

  revalidatePath("/discount-rules");
  revalidatePath("/check-in");
  revalidatePath("/");
  return { error: null };
}
