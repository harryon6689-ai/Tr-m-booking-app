"use server";

import { createClient } from "@/lib/supabase/server";
import {
  getGoogleDriveConnection,
  clearGoogleDriveConnection,
  uploadBackupToDrive,
} from "@/lib/google-drive";

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
    return { supabase, error: "Chỉ admin mới có quyền sao lưu dữ liệu." as const };
  }

  return { supabase, error: null };
}

const BACKUP_TABLES = [
  "bookings",
  "fixed_customers",
  "fixed_customer_checkins",
  "kol_bookings",
  "preferred_customers",
  "discount_rules",
  "pricing_rules",
  "locations",
  "users",
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

export async function getFullDataBackup(): Promise<
  { error: string; data: null } | { error: null; data: Record<BackupTable, Record<string, unknown>[]> }
> {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError, data: null };

  const results = await Promise.all(
    BACKUP_TABLES.map((table) => supabase.from(table).select("*"))
  );

  for (const result of results) {
    if (result.error) return { error: result.error.message, data: null };
  }

  const data = {} as Record<BackupTable, Record<string, unknown>[]>;
  BACKUP_TABLES.forEach((table, i) => {
    data[table] = (results[i].data ?? []) as Record<string, unknown>[];
  });

  return { error: null, data };
}

export async function getGoogleDriveStatus(): Promise<
  { error: string; email: null } | { error: null; email: string | null }
> {
  const { error: authError } = await requireAdmin();
  if (authError) return { error: authError, email: null };

  const connection = await getGoogleDriveConnection();
  return { error: null, email: connection?.email ?? null };
}

export async function disconnectGoogleDrive(): Promise<{ error: string | null }> {
  const { error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  await clearGoogleDriveConnection();
  return { error: null };
}

/** `fileBase64` is the .xlsx file's bytes, base64-encoded by the caller. */
export async function uploadBackupFile(
  fileBase64: string,
  filename: string
): Promise<{ error: string | null }> {
  const { error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const bytes = Buffer.from(fileBase64, "base64");
  return uploadBackupToDrive(bytes, filename);
}
