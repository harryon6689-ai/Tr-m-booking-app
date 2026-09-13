"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireEditAccess } from "@/lib/actions/require-edit-access";

export async function setFixedCustomerArrived(
  fixedCustomerId: string,
  occurrenceDate: string,
  arrived: boolean
) {
  const supabase = await createClient();
  const { userId, error: authError } = await requireEditAccess(supabase);
  if (authError) return { error: authError };

  const { error } = await supabase.from("fixed_customer_checkins").upsert({
    fixed_customer_id: fixedCustomerId,
    occurrence_date: occurrenceDate,
    arrived,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  });

  if (error) return { error: error.message };

  revalidatePath("/check-in");
  return { error: null };
}
