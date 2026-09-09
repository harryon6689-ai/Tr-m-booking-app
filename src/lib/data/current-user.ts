import { createClient } from "@/lib/supabase/server";
import type { UserPermissions, UserRole } from "@/lib/types/database";

export interface CurrentUser {
  id: string;
  email: string | null;
  name: string;
  role: UserRole;
  active: boolean;
  permissions: UserPermissions;
  view_only: boolean;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("name, role, active, permissions, view_only")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return {
    id: user.id,
    email: user.email ?? null,
    name: profile.name,
    role: profile.role,
    active: profile.active,
    permissions: profile.permissions,
    view_only: profile.view_only,
  };
}
