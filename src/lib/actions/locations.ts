"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
    return { supabase, error: "Chỉ admin mới có quyền chỉnh sửa chính sách." as const };
  }

  return { supabase, error: null };
}

export interface LocationPolicyInput {
  minimumSpend: number | null;
  includedHours: number;
  overageFeePerHour: number | null;
}

export async function updateLocationPolicy(
  locationId: string,
  input: LocationPolicyInput
) {
  const { supabase, error: authError } = await requireAdmin();
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
