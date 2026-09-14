import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

type EditAccessResult =
  | { userId: string; error: null }
  | { userId: null; error: string };

/** Authenticated + not a "view only" staff account. Admins always pass. */
export async function requireEditAccess(supabase: Supabase): Promise<EditAccessResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { userId: null, error: "Bạn chưa đăng nhập." };

  const { data: profile } = await supabase
    .from("users")
    .select("role, view_only")
    .eq("id", user.id)
    .single();

  if (!profile) return { userId: null, error: "Không tìm thấy tài khoản." };

  if (profile.role !== "admin" && profile.view_only) {
    return {
      userId: null,
      error: "Tài khoản chỉ xem, không thể thực hiện thao tác này.",
    };
  }

  return { userId: user.id, error: null };
}

type PricingEditAccessResult =
  | { supabase: Supabase; error: null }
  | { supabase: Supabase; error: string };

/**
 * Chính sách giá (discount %, pricing rules, minimum-spend/overage policy) is
 * view-only for staff by default — admins always pass, staff need the
 * separate "discount_rules_edit" permission opted in for them.
 */
export async function requirePricingEditAccess(): Promise<PricingEditAccessResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase, error: "Bạn chưa đăng nhập." };

  const { data: profile } = await supabase
    .from("users")
    .select("role, permissions")
    .eq("id", user.id)
    .single();

  if (!profile) return { supabase, error: "Không tìm thấy tài khoản." };

  if (profile.role !== "admin" && !profile.permissions?.discount_rules_edit) {
    return { supabase, error: "Bạn không có quyền sửa chính sách giá." };
  }

  return { supabase, error: null };
}
