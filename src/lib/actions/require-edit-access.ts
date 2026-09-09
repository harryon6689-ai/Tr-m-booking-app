import type { createClient } from "@/lib/supabase/server";

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
