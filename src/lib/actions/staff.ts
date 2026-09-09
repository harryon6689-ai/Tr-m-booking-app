"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { normalizePhone, phoneToSyntheticEmail } from "@/lib/phone-auth";
import type { UserPermissions, UserRole } from "@/lib/types/database";

export interface StaffAccountInput {
  name: string;
  phone: string;
  role: UserRole;
  permissions: UserPermissions;
  active: boolean;
  view_only: boolean;
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase, error: "Bạn chưa đăng nhập." as const, currentUserId: null };

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return {
      supabase,
      error: "Chỉ admin mới có quyền quản lý tài khoản nhân viên." as const,
      currentUserId: user.id,
    };
  }

  return { supabase, error: null, currentUserId: user.id };
}

export async function getAllStaffAccounts() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function createStaffAccount(
  input: StaffAccountInput & { password: string }
) {
  const { error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const normalizedPhone = normalizePhone(input.phone);
  if (!normalizedPhone) return { error: "Số điện thoại không hợp lệ." };

  const admin = createAdminClient();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("phone", normalizedPhone)
    .maybeSingle();

  if (existing) return { error: "Số điện thoại này đã được dùng cho tài khoản khác." };

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: phoneToSyntheticEmail(normalizedPhone),
    password: input.password,
    email_confirm: true,
  });

  if (createError || !created.user) {
    return { error: createError?.message ?? "Không thể tạo tài khoản." };
  }

  const { error: profileError } = await admin.from("users").insert({
    id: created.user.id,
    name: input.name,
    phone: normalizedPhone,
    role: input.role,
    active: input.active,
    permissions: input.permissions,
    view_only: input.view_only,
  });

  if (profileError) {
    // Roll back the auth user so we don't leave an orphaned login.
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: profileError.message };
  }

  revalidatePath("/staff");
  return { error: null };
}

export async function updateStaffAccount(
  id: string,
  input: StaffAccountInput
) {
  const { error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const normalizedPhone = normalizePhone(input.phone);
  if (!normalizedPhone) return { error: "Số điện thoại không hợp lệ." };

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("users")
    .select("id, phone")
    .eq("id", id)
    .single();

  if (!existing) return { error: "Không tìm thấy tài khoản." };

  if (existing.phone !== normalizedPhone) {
    const { data: phoneTaken } = await admin
      .from("users")
      .select("id")
      .eq("phone", normalizedPhone)
      .neq("id", id)
      .maybeSingle();

    if (phoneTaken) return { error: "Số điện thoại này đã được dùng cho tài khoản khác." };

    const { error: emailUpdateError } = await admin.auth.admin.updateUserById(id, {
      email: phoneToSyntheticEmail(normalizedPhone),
    });
    if (emailUpdateError) return { error: emailUpdateError.message };
  }

  const { error } = await admin
    .from("users")
    .update({
      name: input.name,
      phone: normalizedPhone,
      role: input.role,
      active: input.active,
      permissions: input.permissions,
      view_only: input.view_only,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/staff");
  return { error: null };
}

export async function deleteStaffAccount(id: string) {
  const { error: authError, currentUserId } = await requireAdmin();
  if (authError) return { error: authError };

  if (id === currentUserId) {
    return { error: "Bạn không thể tự xóa tài khoản đang đăng nhập của mình." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return { error: error.message };

  revalidatePath("/staff");
  return { error: null };
}

export async function resetStaffPassword(id: string, newPassword: string) {
  const { error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(id, {
    password: newPassword,
  });

  if (error) return { error: error.message };

  return { error: null };
}
