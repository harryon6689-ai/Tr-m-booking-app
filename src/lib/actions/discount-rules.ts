"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateDiscountRule(
  id: string,
  input: { default_percent: number; active: boolean }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Bạn chưa đăng nhập." };

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { error: "Chỉ admin mới có quyền sửa mức giảm giá." };
  }

  const { error } = await supabase.from("discount_rules").update(input).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/discount-rules");
  return { error: null };
}
